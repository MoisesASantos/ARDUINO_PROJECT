// ============================================
// SERVIDOR INTERMEDIÁRIO — PORTÃO AUTOMÁTICO
// Node.js + Express + Bluetooth + Supabase
// Comunicação: Web App <-> Arduino UNO (via Bluetooth HC-05/HC-06)
// ============================================
// INSTALAÇÃO:
//   npm install express bluetooth-serial-port cors @supabase/supabase-js dotenv
// EXECUTAR:
//   node server.js
// ============================================

const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { BluetoothSerialPort } = require('bluetooth-serial-port');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// VALIDAÇÃO DAS VARIÁVEIS DE AMBIENTE
// ============================================
console.log('\n🔍 Verificando configurações do ambiente...\n');

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  console.error('❌ ERRO: Variáveis do Supabase não encontradas no arquivo .env!');
  console.error('');
  console.error('   Para resolver, crie um arquivo .env na raiz do projeto com:');
  console.error('   ──────────────────────────────────────────────');
  console.error('   SUPABASE_URL=https://seu-projeto.supabase.co');
  console.error('   SUPABASE_ANON_KEY=sua-chave-anon-aqui');
  console.error('   ──────────────────────────────────────────────');
  console.error('');
  process.exit(1);
}

// ============================================
// CONFIGURAÇÃO DO SUPABASE
// ============================================
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

console.log('✅ SUPABASE_URL:', SUPABASE_URL);
console.log('✅ SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY.substring(0, 20) + '...');
console.log('');

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================
// CONFIGURAÇÃO BLUETOOTH (substitui SerialPort)
// ============================================
let arduinoPort = null;
let arduinoConnected = false;
let btSerial = null;
let reconnectTimer = null;
let isConnecting = false;

// ============================================
// CONEXÃO COM ARDUINO VIA BLUETOOTH
// ============================================
function connectArduino() {
  if (isConnecting) return;
  isConnecting = true;

  console.log('\n🔍 Procurando dispositivos Bluetooth...');
  
  btSerial = new BluetoothSerialPort();
  
  // Iniciar busca por dispositivos
  btSerial.inquire();
  
  let foundDevice = false;
  const searchTimeout = setTimeout(() => {
    if (!arduinoConnected && !foundDevice) {
      console.log('⏳ Nenhum dispositivo HC-05 encontrado. Tentando novamente em 10s...');
      isConnecting = false;
      setTimeout(connectArduino, 10000);
    }
  }, 15000);
  
  btSerial.on('found', (address, name) => {
    if (foundDevice || arduinoConnected) return;
    
    console.log(`📡 Dispositivo encontrado: ${name} (${address})`);
    
    // Verifica se é o módulo HC-05/HC-06 ou algum dispositivo Arduino
    const deviceName = name ? name.toLowerCase() : '';
    if (deviceName.includes('hc-05') || 
        deviceName.includes('hc-06') || 
        deviceName.includes('arduino') ||
        deviceName.includes('bt')) {
      
      foundDevice = true;
      clearTimeout(searchTimeout);
      
      console.log(`🔗 Tentando conectar ao ${name}...`);
      
      btSerial.findSerialPortChannel(address, (channel) => {
        btSerial.connect(address, channel, () => {
          arduinoConnected = true;
          arduinoPort = btSerial;
          isConnecting = false;
          console.log('✅ Arduino conectado via Bluetooth!');
          console.log(`📡 Dispositivo: ${name} (${address})`);
          
          // Configurar recebimento de dados
          btSerial.on('data', (data) => {
            const message = data.toString('utf-8').trim();
            if (message.length > 0) {
              console.log('[Arduino] 📨', message);
              processArduinoMessage(message);
            }
          });
          
          btSerial.on('closed', () => {
            arduinoConnected = false;
            arduinoPort = null;
            console.warn('⚠️ Conexão Bluetooth fechada. Reconectando em 5s...');
            setTimeout(connectArduino, 5000);
          });
          
        }, (error) => {
          console.error('❌ Falha ao conectar:', error);
          foundDevice = false;
          isConnecting = false;
          setTimeout(connectArduino, 5000);
        });
      });
    }
  });
  
  btSerial.on('error', (err) => {
    console.error('[Bluetooth] Erro:', err);
    isConnecting = false;
  });
}

// ============================================
// PROCESSAR MENSAGENS DO ARDUINO
// ============================================
async function processArduinoMessage(message) {
  if (message.includes('OPEN_OK')) {
    console.log('[Arduino] ✅ Portão aberto com sucesso');
  } else if (message.includes('CLOSE_OK')) {
    console.log('[Arduino] ✅ Portão fechado com sucesso');
  } else if (message.includes('DENY_OK')) {
    console.log('[Arduino] ⛔ Acesso negado');
  } else if (message.includes('ESTADO:')) {
    console.log('[Arduino] 📊', message);
  } else if (message.includes('CMD:')) {
    console.log('[Arduino] 📟', message);
  }
}

// ============================================
// FUNÇÕES SUPABASE (INALTERADAS)
// ============================================

async function getUsers() {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('nome');
  
  if (error) {
    console.error('[Supabase] Erro ao buscar utilizadores:', error);
    return [];
  }
  return data;
}

async function addUser(nome, bilhete, senha, adminId = null) {
  const { data, error } = await supabase
    .from('users')
    .insert([{ 
      nome, 
      bilhete, 
      senha,
      criado_por: adminId,
      ativo: true
    }])
    .select();
  
  if (error) throw error;
  return data;
}

async function deleteUserByBilhete(bilhete) {
  const { error } = await supabase
    .from('users')
    .delete()
    .eq('bilhete', bilhete);
  
  if (error) throw error;
}

async function toggleUserStatus(bilhete, ativo) {
  const { error } = await supabase
    .from('users')
    .update({ ativo })
    .eq('bilhete', bilhete);
  
  if (error) throw error;
}

async function getAdmin(username, senha) {
  const { data, error } = await supabase
    .from('admins')
    .select('*')
    .eq('username', username)
    .eq('senha', senha)
    .single();
  
  if (error) {
    console.error('[Supabase] Erro ao buscar admin:', error);
    return null;
  }
  return data;
}

async function logAdminAction(adminId, acao, detalhes = '') {
  const { error } = await supabase
    .from('admin_logs')
    .insert([{ 
      admin_id: adminId, 
      acao, 
      detalhes,
      ts: new Date().toISOString() 
    }]);
  
  if (error) console.error('[Supabase] Erro ao registrar log:', error);
}

async function addHistory(bilhete, nome, ok) {
  const { error } = await supabase
    .from('access_history')
    .insert([{ 
      bilhete, 
      nome, 
      ok, 
      ts: new Date().toISOString() 
    }]);
  
  if (error) console.error('[Supabase] Erro ao registrar histórico:', error);
}

async function getHistory(limit = 50) {
  const { data, error } = await supabase
    .from('access_history')
    .select('*')
    .order('ts', { ascending: false })
    .limit(limit);
  
  if (error) {
    console.error('[Supabase] Erro ao buscar histórico:', error);
    return [];
  }
  return data;
}

async function getAdminLogs(limit = 30) {
  const { data, error } = await supabase
    .from('admin_logs')
    .select('*, admins(nome)')
    .order('ts', { ascending: false })
    .limit(limit);
  
  if (error) {
    console.error('[Supabase] Erro ao buscar logs:', error);
    return [];
  }
  return data;
}

// ============================================
// TESTAR CONEXÃO COM SUPABASE
// ============================================
async function testSupabaseConnection() {
  try {
    console.log('🔍 Testando conexão com Supabase...');
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);
    
    if (error) throw error;
    
    console.log('✅ Conexão com Supabase estabelecida com sucesso!');
    return true;
  } catch (err) {
    console.error('❌ Erro ao conectar ao Supabase:', err.message);
    console.error('   Verifique se:');
    console.error('   1. As credenciais no .env estão corretas');
    console.error('   2. O projeto Supabase está ativo');
    console.error('   3. As tabelas "users", "admins" e "access_history" existem');
    return false;
  }
}

// ============================================
// ENVIAR COMANDO AO ARDUINO VIA BLUETOOTH
// ============================================
function sendToArduino(command) {
  return new Promise((resolve, reject) => {
    if (!arduinoConnected || !arduinoPort) {
      return reject(new Error('Arduino não conectado via Bluetooth'));
    }

    const buffer = Buffer.from(command + '\n', 'utf-8');
    arduinoPort.write(buffer, (err) => {
      if (err) {
        console.error('[Bluetooth] Erro ao enviar:', err);
        reject(err);
      } else {
        console.log(`[Bluetooth] ⚡ Comando enviado: ${command}`);
        resolve(true);
      }
    });
  });
}

// ============================================
// MIDDLEWARE
// ============================================
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ============================================
// ROTAS DA API - ARDUINO
// ============================================

app.get('/api/status', (req, res) => {
  res.json({
    ok: true,
    arduino: arduinoConnected,
    connection: 'bluetooth',
    timestamp: new Date().toISOString()
  });
});

app.post('/api/gate/OPEN', async (req, res) => {
  console.log('[API] Pedido de ABERTURA recebido');
  try {
    await sendToArduino('OPEN');
    res.json({ ok: true, command: 'OPEN', message: 'Comando enviado ao Arduino via Bluetooth' });
  } catch (err) {
    console.error('[API] Erro ao abrir:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/gate/CLOSE', async (req, res) => {
  console.log('[API] Pedido de FECHO recebido');
  try {
    await sendToArduino('CLOSE');
    res.json({ ok: true, command: 'CLOSE', message: 'Comando enviado ao Arduino via Bluetooth' });
  } catch (err) {
    console.error('[API] Erro ao fechar:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/gate/DENY', async (req, res) => {
  console.log('[API] Acesso NEGADO registado');
  try {
    await sendToArduino('DENY');
  } catch {}
  res.json({ ok: true, command: 'DENY' });
});

// ============================================
// ROTAS DA API - SUPABASE (USERS) - INALTERADAS
// ============================================

app.get('/api/users', async (req, res) => {
  try {
    const users = await getUsers();
    res.json({ ok: true, data: users });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/users', async (req, res) => {
  const { nome, bilhete, senha, adminId } = req.body;
  
  if (!nome || !bilhete || !senha) {
    return res.status(400).json({ ok: false, error: 'Dados incompletos' });
  }
  
  try {
    const { data: existing } = await supabase
      .from('users')
      .select('bilhete')
      .eq('bilhete', bilhete);
    
    if (existing && existing.length > 0) {
      return res.status(400).json({ ok: false, error: 'Bilhete já registado' });
    }
    
    const user = await addUser(nome, bilhete, senha, adminId);
    if (adminId) {
      await logAdminAction(adminId, 'CRIAR_USUARIO', `Criou usuário: ${nome} (${bilhete})`);
    }
    res.json({ ok: true, data: user });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.delete('/api/users/:bilhete', async (req, res) => {
  const { bilhete } = req.params;
  const { adminId } = req.body;
  
  try {
    await deleteUserByBilhete(bilhete);
    if (adminId) {
      await logAdminAction(adminId, 'DELETAR_USUARIO', `Removeu usuário: ${bilhete}`);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.patch('/api/users/:bilhete/toggle', async (req, res) => {
  const { bilhete } = req.params;
  const { ativo, adminId } = req.body;
  
  try {
    await toggleUserStatus(bilhete, ativo);
    if (adminId) {
      await logAdminAction(adminId, 'ALTERAR_STATUS', 
        `${ativo ? 'Ativou' : 'Desativou'} usuário: ${bilhete}`);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ============================================
// ROTAS DA API - SUPABASE (ADMIN) - INALTERADAS
// ============================================

app.post('/api/admin/login', async (req, res) => {
  const { username, senha } = req.body;
  
  try {
    const admin = await getAdmin(username, senha);
    if (!admin) {
      return res.status(401).json({ ok: false, error: 'Credenciais inválidas' });
    }
    
    await logAdminAction(admin.id, 'LOGIN', 'Login realizado');
    res.json({ ok: true, data: admin });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/admin/logs', async (req, res) => {
  try {
    const logs = await getAdminLogs();
    res.json({ ok: true, data: logs });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ============================================
// ROTAS DA API - SUPABASE (HISTORY) - INALTERADAS
// ============================================

app.get('/api/history', async (req, res) => {
  try {
    const history = await getHistory();
    res.json({ ok: true, data: history });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/history', async (req, res) => {
  const { bilhete, nome, ok } = req.body;
  
  try {
    await addHistory(bilhete, nome, ok);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ============================================
// ROTA PARA VERIFICAR CONEXÃO COM SUPABASE
// ============================================
app.get('/api/supabase/status', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);
    
    if (error) throw error;
    
    res.json({
      ok: true,
      connected: true,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.json({
      ok: false,
      connected: false,
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ============================================
// INICIAR SERVIDOR
// ============================================
app.listen(PORT, "0.0.0.0", async () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║      SERVIDOR PORTÃO AUTOMÁTICO - BLUETOOTH     ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  🌐 Web App:  http://localhost:${PORT}                ║`);
  console.log(`║  📡 API:      http://localhost:${PORT}/api            ║`);
  console.log(`║  🔌 Conexão:  Bluetooth HC-05/HC-06             ║`);
  console.log(`║  🗄️ Supabase: ${SUPABASE_URL.substring(0, 30).padEnd(40)}║`);
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');
  console.log('📌 IMPORTANTE:');
  console.log('   - Certifique-se que o módulo Bluetooth HC-05/HC-06 está conectado ao Arduino');
  console.log('   - O Arduino deve estar alimentado');
  console.log('   - O módulo Bluetooth deve estar pareado com o computador');
  console.log('');
  
  await testSupabaseConnection();
  connectArduino();
});

// ============================================
// TRATAMENTO DE FECHAMENTO
// ============================================
process.on('SIGINT', () => {
  console.log('\n👋 Encerrando servidor...');
  if (btSerial) {
    try { btSerial.close(); } catch {}
  }
  process.exit();
});

process.on('SIGTERM', () => {
  console.log('\n👋 Encerrando servidor...');
  if (btSerial) {
    try { btSerial.close(); } catch {}
  }
  process.exit();
});

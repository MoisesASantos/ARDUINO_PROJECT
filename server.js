// ============================================
// SERVIDOR INTERMEDIÁRIO — PORTÃO AUTOMÁTICO
// Node.js + Express + SerialPort + Supabase
// Comunicação: Web App <-> Arduino UNO
// ============================================
// INSTALAÇÃO:
//   npm install express serialport cors @supabase/supabase-js dotenv
// EXECUTAR:
//   node server.js
// ============================================

const express = require('express');
const { SerialPort } = require('serialport');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

// ============================================
// VALIDAÇÃO DAS VARIÁVEIS DE AMBIENTE
// ============================================
console.log('\n🔍 Verificando configurações do ambiente...\n');

// Verificar se o arquivo .env foi carregado
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  console.error(' ERRO: Variáveis do Supabase não encontradas no arquivo .env!');
  console.error('');
  console.error('   Para resolver, crie um arquivo .env na raiz do projeto com:');
  console.error('   ──────────────────────────────────────────────');
  console.error('   SUPABASE_URL=https://seu-projeto.supabase.co');
  console.error('   SUPABASE_ANON_KEY=sua-chave-anon-aqui');
  console.error('   ──────────────────────────────────────────────');
  console.error('');
  console.error('   Ou defina as variáveis diretamente no sistema:');
  console.error('   export SUPABASE_URL="https://seu-projeto.supabase.co"');
  console.error('   export SUPABASE_ANON_KEY="sua-chave-anon-aqui"');
  console.error('');
  process.exit(1); // Para o servidor
}

// ============================================
// CONFIGURAÇÃO DO SUPABASE (APENAS DO .env)
// ============================================
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

console.log(' SUPABASE_URL:', SUPABASE_URL);
console.log(' SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY.substring(0, 20) + '...');
console.log('');

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================
// CONFIGURAÇÃO DA PORTA SERIAL
// ============================================
const SERIAL_PORT = process.env.SERIAL_PORT || '/dev/ttyACM0';
const BAUD_RATE = 9600;

let arduinoPort = null;
let arduinoConnected = false;

// ============================================
// CONEXÃO COM ARDUINO
// ============================================
function connectArduino() {
  try {
    arduinoPort = new SerialPort({
      path: SERIAL_PORT,
      baudRate: BAUD_RATE,
      autoOpen: true
    });

    arduinoPort.on('open', () => {
      arduinoConnected = true;
      console.log(`[Arduino] Conectado em ${SERIAL_PORT} a ${BAUD_RATE} baud`);
    });

    arduinoPort.on('data', (data) => {
      const message = data.toString().trim();
      console.log('[Arduino] Mensagem recebida:', message);
      
      // Processar mensagens do Arduino (ex: confirmação de abertura/fechamento)
      processArduinoMessage(message);
    });

    arduinoPort.on('error', (err) => {
      arduinoConnected = false;
      console.error('[Arduino] Erro serial:', err.message);
    });

    arduinoPort.on('close', () => {
      arduinoConnected = false;
      console.warn('[Arduino] Porta fechada. A tentar reconectar em 5s...');
      setTimeout(connectArduino, 5000);
    });

  } catch (err) {
    console.error('[Arduino] Não foi possível conectar:', err.message);
    console.log('[Arduino] A tentar novamente em 5 segundos...');
    setTimeout(connectArduino, 5000);
  }
}

// ============================================
// PROCESSAR MENSAGENS DO ARDUINO
// ============================================
async function processArduinoMessage(message) {
  // Exemplo: Arduino envia "OPEN_OK" ou "CLOSE_OK" quando completa a ação
  if (message.includes('OPEN_OK')) {
    console.log('[Arduino] Portão aberto com sucesso');
    // Registrar no Supabase se necessário
  } else if (message.includes('CLOSE_OK')) {
    console.log('[Arduino] Portão fechado com sucesso');
  } else if (message.includes('DENY_OK')) {
    console.log('[Arduino] Acesso negado');
  }
}

// ============================================
// FUNÇÕES SUPABASE
// ============================================

// USERS
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

// ADMIN
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

// HISTORY
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
// ENVIAR COMANDO AO ARDUINO
// ============================================
function sendToArduino(command) {
  return new Promise((resolve, reject) => {
    if (!arduinoConnected || !arduinoPort) {
      return reject(new Error('Arduino não conectado'));
    }

    arduinoPort.write(command + '\n', (err) => {
      if (err) {
        reject(err);
      } else {
        console.log(`[Arduino] Comando enviado: ${command}`);
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
app.use(express.static(path.join(__dirname)));

// ============================================
// ROTAS DA API - ARDUINO
// ============================================

// Verificar status
app.get('/api/status', (req, res) => {
  res.json({
    ok: true,
    arduino: arduinoConnected,
    port: SERIAL_PORT,
    timestamp: new Date().toISOString()
  });
});

// Abrir portão
app.post('/api/gate/OPEN', async (req, res) => {
  console.log('[API] Pedido de ABERTURA recebido');
  try {
    await sendToArduino('OPEN');
    res.json({ ok: true, command: 'OPEN', message: 'Comando enviado ao Arduino' });
  } catch (err) {
    console.error('[API] Erro ao abrir:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Fechar portão
app.post('/api/gate/CLOSE', async (req, res) => {
  console.log('[API] Pedido de FECHO recebido');
  try {
    await sendToArduino('CLOSE');
    res.json({ ok: true, command: 'CLOSE', message: 'Comando enviado ao Arduino' });
  } catch (err) {
    console.error('[API] Erro ao fechar:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Negar acesso
app.post('/api/gate/DENY', async (req, res) => {
  console.log('[API] Acesso NEGADO registado');
  try {
    await sendToArduino('DENY');
  } catch {}
  res.json({ ok: true, command: 'DENY' });
});

// ============================================
// ROTAS DA API - SUPABASE (USERS)
// ============================================

// Listar usuários
app.get('/api/users', async (req, res) => {
  try {
    const users = await getUsers();
    res.json({ ok: true, data: users });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Registrar usuário
app.post('/api/users', async (req, res) => {
  const { nome, bilhete, senha, adminId } = req.body;
  
  if (!nome || !bilhete || !senha) {
    return res.status(400).json({ ok: false, error: 'Dados incompletos' });
  }
  
  try {
    // Verificar se já existe
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

// Deletar usuário
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

// Ativar/desativar usuário
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
// ROTAS DA API - SUPABASE (ADMIN)
// ============================================

// Login admin
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

// Logs de admin
app.get('/api/admin/logs', async (req, res) => {
  try {
    const logs = await getAdminLogs();
    res.json({ ok: true, data: logs });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ============================================
// ROTAS DA API - SUPABASE (HISTORY)
// ============================================

// Histórico de acessos
app.get('/api/history', async (req, res) => {
  try {
    const history = await getHistory();
    res.json({ ok: true, data: history });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Registrar acesso
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
app.listen(PORT, async () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║        SERVIDOR PORTÃO AUTOMÁTICO v2.0          ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║   Web App:  http://localhost:${PORT}                ║`);
  console.log(`║   API:      http://localhost:${PORT}/api            ║`);
  console.log(`║   Porta:    ${SERIAL_PORT.padEnd(40)}║`);
  console.log(`║   Supabase: ${SUPABASE_URL.substring(0, 30).padEnd(40)}║`);
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');
  
  // Testar conexão com Supabase
  await testSupabaseConnection();
  
  // Conectar Arduino
  connectArduino();
});

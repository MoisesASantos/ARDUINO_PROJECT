# 🔐 Portão Automático — Sistema Completo

## Arquitetura do Sistema

```
[Web App (index.html)]  →  [Servidor Node.js (server.js)]  →  [Arduino UNO]
      Browser                   HTTP / API REST                 Serial USB
```

## Ficheiros incluídos

| Ficheiro | Descrição |
|----------|-----------|
| `index.html` | Aplicativo web (abre no browser) |
| `server.js` | Servidor intermediário Node.js |
| `arduino_portao.ino` | Código Arduino atualizado |

---

## ⚡ Instalação Rápida

### 1. Arduino
1. Abrir `arduino_portao.ino` na Arduino IDE
2. Carregar para o Arduino UNO
3. Verificar a porta COM (ex: COM3, /dev/ttyUSB0)

### 2. Servidor Node.js
```bash
# Instalar dependências
npm install express serialport cors

# Editar a porta serial no server.js (linha SERIAL_PORT)
# Windows: 'COM3'   Linux: '/dev/ttyUSB0'

# Executar
node server.js
```

### 3. Web App
- Abrir `index.html` no browser, ou
- Aceder a `http://localhost:8080` (se servido pelo Node.js)

---

## 🔑 Credenciais Padrão

| Tipo | Bilhete | Senha |
|------|---------|-------|
| Utilizador exemplo | ANG-2024-001 | 1234 |
| Administrador | — | admin123 |

> ⚠️ Mude as senhas em produção!

---

## ⚙️ Configurações

### Alterar porta Admin (`index.html`, linha `ADMIN_PW`)
```javascript
const ADMIN_PW = 'suaSenhaSegura';
```

### Alterar IP do servidor (`index.html`, linha `ARDUINO_API`)
```javascript
const ARDUINO_API = 'http://192.168.1.100:8080'; // IP da máquina com o Node.js
```

### Alterar porta Serial (`server.js`)
```javascript
const SERIAL_PORT = 'COM3'; // ou '/dev/ttyUSB0'
```

---

## 🔌 Ligações do Arduino

| Componente | Pino Arduino |
|------------|-------------|
| Servo Motor (sinal) | D6 |
| HC-SR04 TRIG | D9 |
| HC-SR04 ECHO | D10 |
| LED Verde | D4 |
| LED Vermelho | D5 |
| Buzzer | D7 |

---

## 📱 Funcionalidades do Web App

- **Login** com número de bilhete + senha
- **Animação** do portão a abrir/fechar
- **Countdown** de 5 segundos
- **Painel Admin** para registar/remover utilizadores
- **Histórico** dos últimos 50 acessos
- **Modo demo** (funciona mesmo sem o servidor Node.js)

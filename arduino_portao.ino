// ============================================
// PORTÃO AUTOMÁTICO — ARDUINO UNO
// Sensor HC-SR04 + Servo + Controlo Web
// Versão sem delay() — não bloqueia Serial
// ============================================
// Comandos recebidos via Serial (USB):
//   OPEN  → Abre o portão
//   CLOSE → Fecha o portão
//   DENY  → LED vermelho + buzzer (negado)
// ============================================

#include <Servo.h>

Servo portao;

// ---- Pinos ----
const int trigPin         = 9;
const int echoPin         = 10;
const int pinoServo       = 6;
const int pinoLedVerde    = 4;
const int pinoLedVermelho = 5;
const int pinoBuzzer      = 7;

// ---- Temporização (sem delay) ----
unsigned long tempoAbertura   = 0;
unsigned long tempoSensor     = 0;
unsigned long tempoDeny       = 0;

const unsigned long TEMPO_ABERTO_MS = 5000;  // 5s aberto
const unsigned long INTERVALO_SENSOR = 200;  // mede a cada 200ms

// ---- Estado ----
bool portaoAberto = false;

// ---- DENY sem delay ----
bool denyAtivo       = false;
int  denyPasso       = 0;          // qual passo da sequência
unsigned long denyProximo = 0;
// Sequência: ON 200ms, OFF 150ms, ON 200ms, OFF 150ms, ON 200ms, OFF
const int DENY_PASSOS = 6;
const unsigned long DENY_TEMPO[6] = {200, 150, 200, 150, 200, 150};

// ---- Buffer Serial ----
String cmdBuffer = "";

// ============================================
void setup() {
  Serial.begin(9600);

  pinMode(trigPin,         OUTPUT);
  pinMode(echoPin,         INPUT);
  pinMode(pinoLedVerde,    OUTPUT);
  pinMode(pinoLedVermelho, OUTPUT);
  pinMode(pinoBuzzer,      OUTPUT);

  portao.attach(pinoServo);
  fecharPortao();

  Serial.println("SISTEMA INICIADO");
  Serial.println("Aguardando: OPEN / CLOSE / DENY");
}

// ============================================
void loop() {
  unsigned long agora = millis();

  // ------------------------------------------
  // 1. LER COMANDOS DO SERVIDOR (Serial)
  // ------------------------------------------
  while (Serial.available() > 0) {
    char c = (char)Serial.read();

    if (c == '\n' || c == '\r') {
      cmdBuffer.trim();

      if (cmdBuffer.length() > 0) {

        if (cmdBuffer == "OPEN") {
          Serial.println("CMD:OPEN");
          abrirPortao();

        } else if (cmdBuffer == "CLOSE") {
          Serial.println("CMD:CLOSE");
          fecharPortao();

        } else if (cmdBuffer == "DENY") {
          Serial.println("CMD:DENY");
          iniciarDeny();

        } else {
          Serial.print("CMD desconhecido: ");
          Serial.println(cmdBuffer);
        }
      }
      cmdBuffer = "";

    } else {
      cmdBuffer += c;
    }
  }

  // ------------------------------------------
  // 2. FECHAR AUTOMATICAMENTE após 5 segundos
  // ------------------------------------------
  if (portaoAberto && (agora - tempoAbertura >= TEMPO_ABERTO_MS)) {
    Serial.println("AUTO:FECHANDO");
    fecharPortao();
  }

  // ------------------------------------------
  // 3. ANIMAÇÃO DENY (sem delay)
  // ------------------------------------------
  if (denyAtivo && agora >= denyProximo) {
    // Passos pares = LED/buzzer ON | ímpares = OFF
    if (denyPasso % 2 == 0) {
      digitalWrite(pinoLedVermelho, HIGH);
      tone(pinoBuzzer, 400);
    } else {
      digitalWrite(pinoLedVermelho, LOW);
      noTone(pinoBuzzer);
    }

    denyPasso++;
    if (denyPasso >= DENY_PASSOS) {
      // Fim da sequência
      digitalWrite(pinoLedVermelho, LOW);
      noTone(pinoBuzzer);
      denyAtivo = false;
      denyPasso = 0;
    } else {
      denyProximo = agora + DENY_TEMPO[denyPasso];
    }
  }

  // ------------------------------------------
  // 4. SENSOR ULTRASSÔNICO (a cada 200ms)
  //    Só mede se portão estiver fechado
  // ------------------------------------------
  if (!portaoAberto && !denyAtivo && (agora - tempoSensor >= INTERVALO_SENSOR)) {
    tempoSensor = agora;

    int dist = medirDistancia();

    if (dist > 0 && dist <= 15) {
      Serial.print("SENSOR:");
      Serial.print(dist);
      Serial.println("cm");
      // Sensor apenas reporta — abertura é pelo Web App
      // Para modo autônomo descomente:
      // abrirPortao();
    }
  }
}

// ============================================
// FUNÇÕES
// ============================================

void abrirPortao() {
  portao.write(90);
  portaoAberto  = true;
  tempoAbertura = millis();
  digitalWrite(pinoLedVerde,    HIGH);
  digitalWrite(pinoLedVermelho, LOW);
  tone(pinoBuzzer, 1000, 80);   // bip curto de confirmação
  Serial.println("ESTADO:ABERTO");
}

void fecharPortao() {
  portao.write(0);
  portaoAberto = false;
  digitalWrite(pinoLedVerde,    LOW);
  digitalWrite(pinoLedVermelho, LOW);
  noTone(pinoBuzzer);
  Serial.println("ESTADO:FECHADO");
}

void iniciarDeny() {
  if (denyAtivo) return;   // já está a executar
  denyAtivo   = true;
  denyPasso   = 0;
  denyProximo = millis();  // começa imediatamente
}

int medirDistancia() {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  long dur = pulseIn(echoPin, HIGH, 25000); // timeout 25ms
  if (dur == 0) return 0;
  return (int)(dur * 0.034 / 2);
}

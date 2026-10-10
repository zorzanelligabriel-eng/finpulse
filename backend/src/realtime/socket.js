const { WebSocketServer } = require('ws');
const { verifyToken } = require('../middleware/auth');

const HEARTBEAT_MS = 30_000;

/**
 * Canal de tempo real. O front abre ws://.../ws?token=<JWT> e passa a receber
 * { type: "market", data: <cotações> } toda vez que o MarketService atualiza.
 */
function attachRealtime(server, market) {
  // noServer: nós mesmos tratamos o "upgrade" para poder checar o token antes de aceitar.
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname !== '/ws') return socket.destroy();

    try {
      request.userId = verifyToken(url.searchParams.get('token') || '');
    } catch {
      socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
      return socket.destroy();
    }
    wss.handleUpgrade(request, socket, head, (ws) => wss.emit('connection', ws, request));
  });

  const message = (snapshot) => JSON.stringify({ type: 'market', data: snapshot });

  wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.on('pong', () => (ws.isAlive = true));
    ws.on('error', () => ws.terminate());
    // quem acabou de conectar recebe a última cotação na hora, sem esperar a próxima rodada
    ws.send(message(market.getSnapshot()));
  });

  const broadcast = (snapshot) => {
    const payload = message(snapshot);
    for (const client of wss.clients) {
      if (client.readyState === client.OPEN) client.send(payload);
    }
  };
  market.on('update', broadcast);

  // Derruba conexões que pararam de responder (aba fechada sem avisar, queda de rede...).
  const heartbeat = setInterval(() => {
    for (const client of wss.clients) {
      if (!client.isAlive) {
        client.terminate();
        continue;
      }
      client.isAlive = false;
      client.ping();
    }
  }, HEARTBEAT_MS);
  heartbeat.unref();

  return {
    wss,
    close() {
      clearInterval(heartbeat);
      market.off('update', broadcast);
      for (const client of wss.clients) client.terminate();
      wss.close();
    },
  };
}

module.exports = { attachRealtime };

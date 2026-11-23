import { createServer } from "node:net";

export async function startSmtp(t) {
  const messages = [];
  const sockets = new Set();
  const smtp = { behavior: "accept", messages, connections: 0 };
  const server = createServer((socket) => {
    sockets.add(socket);
    smtp.connections++;
    let pending = "";
    let receiving = false;
    let message = "";
    socket.setEncoding("utf8");
    socket.on("error", () => {});
    socket.on("close", () => sockets.delete(socket));
    socket.write("220 fixture.example.test SMTP\r\n");
    socket.on("data", (chunk) => {
      pending += chunk;
      let end;
      while ((end = pending.indexOf("\r\n")) !== -1) {
        const line = pending.slice(0, end);
        pending = pending.slice(end + 2);
        if (receiving) {
          if (line !== ".") { message += line + "\r\n"; continue; }
          receiving = false;
          messages.push(message);
          if (smtp.behavior === "drop") { socket.destroy(); return; }
          socket.write("250 queued fixture message\r\n");
        } else if (/^(EHLO|HELO|MAIL FROM:|RSET)/i.test(line)) {
          socket.write("250 fixture.example.test\r\n");
        } else if (/^RCPT TO:/i.test(line)) {
          socket.write(smtp.behavior === "reject" ? "550 mailbox not available\r\n" : "250 recipient accepted\r\n");
        } else if (line === "DATA") {
          receiving = true;
          socket.write("354 send message\r\n");
        } else if (line === "QUIT") {
          socket.end("221 goodbye\r\n");
        } else {
          socket.write("500 command unavailable\r\n");
        }
      }
    });
  });
  await new Promise((resolve, reject) => server.once("error", reject).listen(0, "127.0.0.1", resolve));
  t.after(() => {
    for (const socket of sockets) socket.destroy();
    server.close();
  });
  smtp.port = server.address().port;
  return smtp;
}

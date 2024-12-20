import { Injectable } from "@nestjs/common";
import { io, Socket as SocketClient } from "socket.io-client";
import { Socket as SocketServer } from "socket.io";

@Injectable()
export class SocketIoService {
  /**
   * Makes a connection to the target Socket.IO server.
   */
  async connectToTargetSocketIO(
    _proxySocketIO: SocketServer,
    _targetUrl: string,
    _namespace: string,
    _headers: Record<string, string> = {},
  ): Promise<SocketClient> {
    const _targetSocketIO = io(`${_targetUrl}${_namespace}`, {
      transports: ["websocket"],
      extraHeaders: _headers,
      reconnection: false,
    });

    // Listen for connect events from the target Socket.IO and forward to the proxy Socket.IO.
    _targetSocketIO.on("connect", () => {
      _proxySocketIO?.emit("sparrow_internal_connect", "io server connect");
    });

    // Listen for connect error events from the target Socket.IO and forward to the proxy Socket.IO.
    _targetSocketIO.on("connect_error", (err) => {
      _proxySocketIO?.emit("sparrow_internal_connect_error", err.message);
      _proxySocketIO?.disconnect();
    });

    // Listen for disconnect events from the target Socket.IO and forward to the proxy Socket.IO.
    _targetSocketIO.on("disconnect", (err) => {
      _proxySocketIO?.emit("sparrow_internal_disconnect", err);
      _proxySocketIO?.disconnect();
    });

    // Listen for all dynamic events from the target Socket.IO and forward to the proxy Socket.IO.
    _targetSocketIO.onAny((event: string, ...args: any[]) => {
      _proxySocketIO?.emit(event, args);
    });

    return _targetSocketIO;
  }
}

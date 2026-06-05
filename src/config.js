// 唯一需要配置的项：云端 API 基址。
// 壳里没有任何核心逻辑——所有对话/工具/数据都在云端。逆向本壳只能看到「往这个地址发请求」。
window.CLOUD_API_BASE = "https://agent.58api.ai";

// 由 HTTP 基址推导 WebSocket 基址（https→wss, http→ws）。
window.CLOUD_WS_BASE = window.CLOUD_API_BASE.replace(/^http/, "ws");

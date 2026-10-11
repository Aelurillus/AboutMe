/* 你的个人网站配置。修改资料、链接和音乐只需要编辑这个文件。 */
window.PROFILE = {
  name: "ItzMing",
  realName: "白铭",
  nickname: "铭铭",
  handle: "ItzMing",
  avatar: "./assets/avatar.webp",
  gateLabel: "[ click ]",
  about: "Hi. I'm ItzMing",
  // 头像的小飞机入口；轮播文字单独在 whisper.config 中管理。
  whisperConfig: "./whisper.config",
  messageURL: "https://t.me/Mingawa",
  cursor: { idle: "./assets/cat-idle.webp", hover: "./assets/cat-hover.webp", pressed: "./assets/cat-pressed.webp" },
  socials: [
    { name: "GitHub", icon: "github", url: "https://github.com/Aelurillus" },
    { name: "Bilibili", icon: "bilibili", url: "https://space.bilibili.com/5401610" },
    { name: "Steam", icon: "steam", url: "https://steamcommunity.com/profiles/76561199634129272/" },
    { name: "Discord", icon: "discord", url: "https://discord.gg/nqVav26j" },
    { name: "Telegram", icon: "telegram", url: "https://t.me/Mingawa" }
  ],
  steam: { name: "ItzMing", id: "76561199634129272", endpoint: "./api/steam", url: "https://steamcommunity.com/profiles/76561199634129272/" },
  clock: { zone: "Asia/Taipei", label: "Timezone" },
  footer: "UTC +08:00",
  // 可连接返回 { views: number } 的同源统计接口；为空时诚实显示本浏览器访问数。
  viewsEndpoint: "",
  music: {
    volume: 0.35,
    autoplayOnEntry: true,
    // list：列表循环；single：单曲循环。
    mode: "list",
    tracks: [
      { id: "dnd", title: "D.N.D", artist: "Pimmie", src: "./music/dnd.mp3", cover: "./music/dnd.jpg", lrc: "./music/dnd.lrc" },
      { id: "plastic", title: "PLASTIC", artist: "sakehands, LO, marty valentine", src: "./music/plastic.mp3", cover: "./music/plastic.jpg", lrc: "./music/plastic.lrc" },
      { id: "my-love", title: "我的爱", artist: "孙燕姿", src: "./music/my-love.mp3", cover: "./music/my-love.png", lrc: "./music/my-love.lrc" },
      { id: "love-song", title: "Love Song", artist: "方大同", src: "./music/love-song.mp3", cover: "./music/love-song.jpg", lrc: "./music/love-song.lrc" }
    ]
  }
};

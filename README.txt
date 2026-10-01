유중코리아 Youzhong Korea — 官网主页（第 3 版）

文件结构
  index.html        页面内容（韩文文案都在这里，直接改文字即可）
  css/style.css     样式与配色
  js/main.js        交互（首屏测序成像、走马灯、表单）
  images/           图片（见 images/README.txt）

页面顺序
  首屏（测序成像 + 슬로건）→ 三项承诺（맞춤 제작 / 납기 / 품질）→ About Us → Products
  → Custom Process（定制流程）→ Production & R&D（走马灯）→ Contact

第 3 版改动
  - 页头 Logo 48px、页脚 Logo 42px（各放大一级）
  - 右下角月亮/太阳按钮切换浅色/深色模式；访客的选择会被浏览器记住
  - Production & R&D 文案改为「하나의 Fab에서」
  - Products：主页面只展开两款 NGS 产品；其余 6 款从顶部 Products 下拉菜单
    或产品区的列表点击，以弹出窗口打开详情（index.html 中 <dialog id="dlg-..."> 部分）
  - 详情窗口可直接用网址打开，例如 index.html#dlg-metalens

使用
  双击 index.html 即可本地预览（需联网，字体来自 CDN）。上传整个文件夹到网站空间即可。

对外承诺的数据（上线前请总部再确认一次）
  - 납기：표준품 5일 / 맞춤 제작 3주 / 사양 검토 1–2일（出自总部测序芯片手册“合作模式”页）
    页面已注明“본사 출하 기준, 한국까지 운송 기간 별도”
  - 품질：가공 정밀도 ±30 nm（出自同一手册“技术优势”页，页面注明为 NGS 기판 기준）

注意
  - 联系表单：点击后打开访客的邮件程序，内容预填到 sales@yz-micronano.co.kr，页面不保存数据。
    如需网页内直接提交，需要后端或表单服务。
  - 字体：Pretendard（jsDelivr）、IBM Plex Mono（Google Fonts），访客联网时自动加载。
  - 首屏测序画面是示意动画（右下角已标 Illustration），不是实测数据。
  - 系统开启“减少动态效果”时，首屏画面静止、走马灯不自动播放。

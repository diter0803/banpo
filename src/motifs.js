const svg = (body, viewBox = "0 0 120 80") =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="none" stroke="#ba5633" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`)}`;

const localMotif = (name) => `./public/materials/derived/${name}.png`;
const bitmap = (id, label, note, file, family, badge = "本地位图") => ({
  id, label, note, group: "motif", family, badge, src: localMotif(file)
});
const borderBitmap = (id, label, note, file) => ({
  id, label, note, group: "border", family: "banpo-border", badge: "半坡图集", src: localMotif(file)
});

window.vectorMotifs = [
  // Fish motifs and parts extracted from the local 40-group Banpo bitmap collection.
  bitmap("fish", "鱼纹 44", "长吻、弧身、单叉尾", "fish-full-44", "fish"),
  bitmap("fish-45", "双目鱼纹 45", "双圆目与双叉尾", "fish-full-45", "fish"),
  bitmap("fish-47", "线身鱼纹 47", "三角鱼头与长线鱼身", "fish-full-47", "fish"),
  bitmap("fish-48", "网格鱼纹 48", "网格填身与细线尾", "fish-full-48", "fish"),
  bitmap("fish-49", "红腹鱼纹 49", "块面鱼身与长尾", "fish-full-49", "fish"),
  bitmap("fish-52", "尖吻鱼纹 52", "折线鱼身与尖吻", "fish-full-52", "fish"),
  bitmap("fish-53", "双目长鱼 53", "双圆目与双尾鳍", "fish-full-53", "fish"),

  bitmap("fish-head", "长吻鱼头", "取自 44 号鱼纹头部", "fish-head-long", "fish-part", "鱼头"),
  bitmap("fish-head-double", "双目鱼头", "取自 45 号双圆目特征", "fish-head-double-eye", "fish-part", "鱼头"),
  bitmap("fish-head-triangle", "三角鱼头", "取自 47 号三角头部", "fish-head-triangle", "fish-part", "鱼头"),
  bitmap("fish-head-net", "网格鱼头", "取自 48 号细线鱼头", "fish-head-net", "fish-part", "鱼头"),
  bitmap("fish-body", "弧线鱼身", "取自 44 号上下弧线", "fish-body-arc", "fish-part", "鱼身"),
  bitmap("fish-body-split", "分带鱼身", "取自 45 号块面结构", "fish-body-split", "fish-part", "鱼身"),
  bitmap("fish-body-line", "长线鱼身", "取自 47 号平行线结构", "fish-body-line", "fish-part", "鱼身"),
  bitmap("fish-body-grid", "网格鱼身", "取自 48 号菱形网格", "fish-body-grid", "fish-part", "鱼身"),
  bitmap("fish-tail", "单叉鱼尾", "取自 44 号鱼纹尾部", "fish-tail-single", "fish-part", "鱼尾"),
  bitmap("fish-tail-double", "双叉鱼尾", "取自 45 号双尾结构", "fish-tail-double", "fish-part", "鱼尾"),
  bitmap("fish-tail-swept", "长线鱼尾", "取自 47 号延伸尾线", "fish-tail-swept", "fish-part", "鱼尾"),
  bitmap("fish-tail-net", "网格鱼尾", "取自 48 号细线尾部", "fish-tail-net", "fish-part", "鱼尾"),

  // Human-face-and-fish motifs, kept complete and also separated into reusable parts.
  bitmap("face", "人面鱼纹 42", "完整冠饰、面部与口衔鱼", "face-fish-complete", "face"),
  bitmap("face-mask", "人面主体", "从 42 号提取面廓与五官", "face-mask", "face-part", "人面"),
  bitmap("face-crown", "三角冠饰", "从 42 号提取冠部结构", "face-crown", "face-part", "冠饰"),
  bitmap("face-mouth-fish", "口衔双鱼", "从 42 号提取口部与双鱼", "face-mouth-fish", "face-part", "口衔鱼"),
  bitmap("face-opposing-fish", "对鱼人面单元", "43 号对鱼与几何面部组合", "face-opposing-fish", "face"),
  bitmap("face-crown-variant", "冠饰人面", "55 号冠饰人面变体", "face-variant-crown", "face"),
  bitmap("face-round-variant", "圆点人面", "55 号圆点环绕变体", "face-variant-round", "face"),
  bitmap("face-fish-variant", "鱼托人面", "55 号鱼形基座变体", "face-variant-fish", "face"),
  bitmap("face-cross-variant", "交叉冠人面", "55 号交叉冠饰变体", "face-variant-cross", "face"),

  { id: "deer", label: "鹿纹", group: "motif", family: "deer", note: "完整姿态/鹿角", src: svg('<path d="M34 34Q53 22 75 36L90 60M42 48 34 68M68 49l7 19M35 33 27 17M35 33l-1-17M34 20 22 8M34 20 43 7M26 15 16 19M40 15l11 3"/><circle cx="30" cy="27" r="2" fill="#ba5633"/>') },
  { id: "frog", label: "蛙纹", group: "motif", family: "frog", note: "仰韶扩展", badge: "扩展", src: svg('<circle cx="60" cy="37" r="18"/><circle cx="60" cy="15" r="8"/><path d="M45 35 25 22 12 38M45 44 25 59 12 45M75 35l20-13 13 16M75 44l20 15 13-14"/>') },

  { id: "triangle-solid", label: "实心三角", group: "geometry", note: "鱼头与块面构件", src: svg('<path d="m22 65 38-52 38 52Z" fill="#ba5633" stroke="none"/>') },
  { id: "triangle-outline", label: "空心三角", group: "geometry", note: "轻量间隔", src: svg('<path d="m22 65 38-52 38 52Z"/>') },
  { id: "zigzag", label: "波折纹", group: "geometry", note: "折线水意", src: svg('<path d="m8 55 18-30 18 30 18-30 18 30 18-30 16 30"/>') },
  { id: "wave", label: "旋涡水纹", group: "geometry", note: "依据 57 号旋涡纹", src: localMotif("water-spiral-2") },
  { id: "grid", label: "网格纹", group: "geometry", note: "鱼身菱形网格", src: svg('<path d="M8 15h104v50H8zM8 15l38 50M28 15l38 50M50 15l38 50M72 15l38 50M46 15 8 65M68 15 28 65M90 15 50 65M112 15 72 65"/>') },
  { id: "dot", label: "圆点", group: "geometry", note: "眼睛与连珠", src: svg('<circle cx="30" cy="40" r="8" fill="#ba5633" stroke="none"/><circle cx="60" cy="40" r="8" fill="#ba5633" stroke="none"/><circle cx="90" cy="40" r="8" fill="#ba5633" stroke="none"/>') },
  { id: "circle", label: "双圆圈", group: "geometry", note: "圆目与环纹", src: svg('<circle cx="35" cy="40" r="18"/><circle cx="35" cy="40" r="9"/><circle cx="85" cy="40" r="18"/><circle cx="85" cy="40" r="9"/>') },
  { id: "strings", label: "弦纹", group: "geometry", note: "平行细线分层", src: svg('<path d="M8 22h104M8 34h104M8 46h104M8 58h104"/>') },

  { id: "band", label: "宽带纹", group: "border", note: "彩陶主带封边", src: svg('<path d="M5 26h110v28H5z" fill="#ba5633" stroke="none"/>') },
  { id: "double-line", label: "双弦边框", group: "border", note: "上下分隔", src: svg('<path d="M5 28h110M5 52h110"/>') },
  { id: "tooth-border", label: "三角齿带", group: "border", note: "连续三角封边", src: svg('<path d="M5 60 18 22 31 60 44 22 57 60 70 22 83 60 96 22 109 60"/>') },
  borderBitmap("border-59", "圆叶连珠带", "59 号圆叶连续单元", "border-59"),
  borderBitmap("border-60", "对叶分隔带", "60 号对叶与弦线", "border-60"),
  borderBitmap("border-61", "双层连珠带", "61 号上下分层结构", "border-61"),
  borderBitmap("border-62", "细密鱼形带", "62 号鱼形连续边饰", "border-62"),
  borderBitmap("border-63", "三角鱼形带", "63 号三角与鱼形分带", "border-63"),
  borderBitmap("border-65", "对鱼连续带", "65 号对鱼循环纹饰", "border-65"),
  borderBitmap("border-66", "圆瓣宽带", "66 号圆瓣连续纹", "border-66"),
  borderBitmap("border-67", "旋鱼卷叶带", "67 号旋转鱼叶纹", "border-67"),
  borderBitmap("border-68", "对叶弦纹带", "68 号叶形与弦线", "border-68"),
  borderBitmap("border-69", "斜叶弦纹带", "69 号斜叶连续纹", "border-69"),
  borderBitmap("border-70", "双线叶纹带", "70 号叶形双线边饰", "border-70"),
  borderBitmap("border-71", "鱼尾三角边饰", "71 号鱼尾与三角组合", "border-71")
];

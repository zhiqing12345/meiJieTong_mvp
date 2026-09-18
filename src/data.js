export const EMPTY_FIELDS = {
  name: '', role: '', phone: '', identity: '',
  outboundTransport: '', outboundDate: '', outboundRoute: '', outboundTrain: '', outboundStation: '', outboundTime: '', outboundArrival: '',
  returnTransport: '', returnDate: '', returnRoute: '', returnTrain: '', returnStation: '', returnTime: '', returnArrival: '',
  hotelDate: '', notes: '',
};

export const FIELD_LABELS = [
  ['name', '出席人'], ['role', '职位'], ['phone', '联系方式'], ['identity', '身份证号码'],
  ['outboundTransport', '去程交通类型'], ['outboundDate', '去程日期'], ['outboundRoute', '去程出发地-抵达地'], ['outboundTrain', '去程航班/车次'], ['outboundStation', '去程到达航站楼/高铁站'], ['outboundTime', '去程出发时间'], ['outboundArrival', '去程抵达时间'],
  ['returnTransport', '返程交通类型'], ['returnDate', '返程日期'], ['returnRoute', '返程出发地-抵达地'], ['returnTrain', '返程航班/车次'], ['returnStation', '返程出发航站楼/高铁站'], ['returnTime', '返程出发时间'], ['returnArrival', '返程抵达时间'],
  ['hotelDate', '住宿日期'],
];

const base = {
  ...EMPTY_FIELDS,
  role: '编辑', phone: '13800000000', identity: '110101199001010000',
  outboundTransport: '飞机', outboundDate: '2026-07-23', outboundRoute: '上海-武汉', outboundTrain: 'MU2506', outboundStation: '天河T3', outboundTime: '11:10', outboundArrival: '13:00',
  returnTransport: '飞机', returnDate: '2026-07-24', returnRoute: '武汉-北京', returnTrain: 'CA8205', returnStation: '天河T3', returnTime: '11:30', returnArrival: '13:30',
  hotelDate: '2026-07-23',
};

export const SAMPLE_TEXT = '出席人：林知远\n职位：编辑\n联系方式：13800000000\n身份证号码：110101199001010000\n去程：2026年7月23日，飞机，上海至武汉，MU2506，到达天河T3，11:10出发，13:00抵达\n返程：2026年7月24日，飞机，武汉至北京，CA8205，从天河T3出发，11:30出发，13:30抵达\n住宿日期：2026年7月23日';
export const SAMPLE_FILES = [{ name: '去程行程示例.svg', url: '/demo-ticket.svg', type: 'image/svg+xml' }, { name: '参会回执示例.svg', url: '/demo-receipt.svg', type: 'image/svg+xml' }];

function demoFilesFor(fields) {
  const escape = value => String(value || '待补充').replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  const line = (value, y, size = 21, fill = '#465b79') => `<text x="45" y="${y}" font-size="${size}" fill="${fill}">${escape(value)}</text>`;
  const image = (title, content, name) => ({ name, type: 'image/svg+xml', demo: true, url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="760"><rect width="640" height="760" fill="#f3f6fb"/><rect x="25" y="95" width="590" height="595" rx="18" fill="white"/><g font-family="Microsoft YaHei,sans-serif">${line(title, 57, 27, '#253959')}${content}${line('虚拟资料 · 仅用于媒介通本地版演示', 733, 16, '#8a99ae')}</g></svg>`)}` });
  return [
    image('往返行程单', line(fields.name, 145, 25) + line(`去程 · ${fields.outboundDate}`, 200, 19, '#7e94b7') + line(fields.outboundRoute.replace('-', ' → '), 250, 28) + line(`${fields.outboundTime} — ${fields.outboundArrival}    ${fields.outboundTrain}`, 300, 23) + line(`${fields.outboundTransport} · ${fields.outboundStation}`, 347, 20) + line(`返程 · ${fields.returnDate}`, 421, 19, '#7e94b7') + line(fields.returnRoute.replace('-', ' → '), 473, 28) + line(`${fields.returnTime} — ${fields.returnArrival}    ${fields.returnTrain}`, 523, 23) + line(`${fields.returnTransport} · ${fields.returnStation}`, 570, 20), `${fields.name}的往返行程.svg`),
    image('参会回执', [['出席人', fields.name], ['职位', fields.role], ['联系方式', fields.phone], ['身份证号码', fields.identity], ['住宿日期', fields.hotelDate]].map(([label, value], i) => line(`${label}：${value || '待补充'}`, 170 + i * 82, 20)).join(''), `${fields.name}的参会回执.svg`),
  ];
}

export function seedData() {
  const people = [
    ['p1', '林知远', 'ready', 'blue', {}],
    ['p2', '李思远', 'needs', 'orange', { role: '摄影', phone: '', returnDate: '', returnTime: '', returnRoute: '', returnTrain: '', returnStation: '', returnArrival: '', notes: '待补充联系方式及返程信息' }],
    ['p3', '陈悦', 'ready', 'purple', { role: '主编', outboundRoute: '北京-武汉', outboundTrain: 'G321', outboundTransport: '高铁', outboundStation: '武汉站', returnRoute: '武汉-北京', returnTrain: 'G324', returnTransport: '高铁', returnStation: '武汉站' }],
    ['p4', '张可言', 'confirmed', 'green', { role: '视频编辑', outboundRoute: '杭州-武汉', outboundTrain: 'G1509', outboundTransport: '高铁', outboundStation: '武汉站', returnRoute: '武汉-杭州', returnTrain: 'G1510', returnTransport: '高铁', returnStation: '武汉站' }],
    ['p5', '赵明', 'failed', 'rose', { ...EMPTY_FIELDS, name: '赵明', role: '记者' }],
  ];
  return [{
    id: 'a1', name: '夏季媒体沟通会', city: '湖北 · 武汉', date: '2026-07-23', endDate: '2026-07-24',
    config: { connected: false, name: '媒体出席及行程表', url: '', startRow: 2, columns: {} },
    people: people.map(([id, name, status, color, extra], i) => ({
      id, status, color, fields: { ...base, name, ...extra },
      messages: [{ id: `m${i}`, role: 'user', text: `${name}老师的参会回执与往返行程，请帮我整理一下。`, files: demoFilesFor({ ...base, name, ...extra }) }, { id: `r${i}`, role: 'assistant', text: status === 'failed' ? '这次未能识别出完整信息。请上传更清晰的图片，或直接填写右侧表单。' : status === 'needs' ? '已整理现有资料，仍有必填内容需要补充。' : '已整理人员信息、往返行程和住宿日期，请逐项核对。' }],
      updatedAt: '刚刚', confirmedAt: status === 'confirmed' ? '2026-07-23 14:32' : null,
    })),
  }, {
    id: 'a2', name: '城市漫游 · 新车品鉴沙龙', city: '浙江 · 杭州', date: '2026-09-08', endDate: '2026-09-09', people: [], config: null,
  }];
}

export const STATUS = {
  draft: { label: '待上传', tone: 'gray' }, recognizing: { label: '识别中', tone: 'blue' }, ready: { label: '待核对', tone: 'blue' },
  needs: { label: '需补充', tone: 'orange' }, failed: { label: '识别失败', tone: 'red' }, confirmed: { label: '已确认', tone: 'green' }, writing: { label: '写入中', tone: 'blue' }, written: { label: '已写入', tone: 'green' },
};
export function uid() { return crypto.randomUUID(); }
export function missingFields(fields) { return [['name', '出席人'], ['phone', '联系方式']].filter(([key]) => !fields[key]?.trim()); }
export function maskPhone(value) { return value ? value.replace(/^(\d{3})\d+(\d{4})$/, '$1 **** $2') : '待补充'; }
export function dateShort(value) { return value ? value.slice(5).replace('-', '.') : '待补充'; }

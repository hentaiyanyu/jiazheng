/** 分 -> 元（整数不显示小数） */
function fenToYuan(fen) {
  const value = Number(fen || 0) / 100;
  return value % 1 === 0 ? String(value) : value.toFixed(2);
}

/** 分 -> 带符号的元（负数用于优惠项） */
function fenToYuanSigned(fen) {
  const value = Number(fen || 0) / 100;
  const text = value % 1 === 0 ? String(Math.abs(value)) : Math.abs(value).toFixed(2);
  return value < 0 ? `-¥${text}` : `¥${text}`;
}

/** 手机号脱敏 */
function maskPhone(phone) {
  if (!phone || phone.length < 7) {
    return phone || '';
  }
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}

/** 生成未来 N 天的日期选项 */
function buildDateOptions(days) {
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const options = [];
  const today = new Date();

  for (let i = 0; i < days; i += 1) {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    options.push({
      value: `${date.getFullYear()}-${month}-${day}`,
      label: i === 0 ? '今天' : i === 1 ? '明天' : weekdays[date.getDay()],
      subLabel: `${month}/${day}`,
    });
  }

  return options;
}

module.exports = { fenToYuan, fenToYuanSigned, maskPhone, buildDateOptions };

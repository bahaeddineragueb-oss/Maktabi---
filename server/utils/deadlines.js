/**
 * Procedural deadline calculation engine.
 *
 * IMPORTANT LEGAL SAFEGUARD:
 * This engine performs *mathematical* date computation only. It does NOT assert
 * any legal deadline rule. Every automatically computed deadline MUST be
 * verified by the lawyer against the applicable procedural texts in force.
 */
const dayjs = require('dayjs');

const ALGERIAN_WEEKEND = [5, 6]; // Friday & Saturday (configurable in settings)

function isWeekend(date, weekendDays) {
  const d = dayjs(date).day(); // 0=Sun ... 5=Fri, 6=Sat
  return (weekendDays || ALGERIAN_WEEKEND).includes(d);
}

/**
 * Compute a deadline end date.
 * @param {Object} p
 * @param {string} p.start_date       ISO date (YYYY-MM-DD)
 * @param {number} p.amount           number of units
 * @param {string} p.unit             'day' | 'month'
 * @param {string} p.day_type         'calendar' | 'business' | 'legal'
 * @param {string} p.direction        'forward' | 'backward'
 * @param {boolean} p.holiday_exclusion
 * @param {Array<{date:string, is_recurring_annual:number}>} p.holidays
 * @param {number[]} p.weekend_days
 * @returns {{end_date:string, steps:Array, excluded_days:number}}
 */
function computeDeadline(p) {
  const amount = Math.abs(parseInt(p.amount, 10) || 0);
  const unit = p.unit === 'month' ? 'month' : 'day';
  const direction = p.direction === 'backward' ? 'backward' : 'forward';
  const sign = direction === 'backward' ? -1 : 1;
  const holidaySet = new Set();
  const holidaySetAnnual = new Set();
  for (const h of p.holidays || []) {
    if (!h.date) continue;
    if (h.is_recurring_annual) holidaySetAnnual.add(h.date.slice(5)); // MM-DD
    else holidaySet.add(h.date);
  }

  const isExcluded = (d) => {
    if (isWeekend(d, p.weekend_days)) return 'weekend';
    const iso = d.format('YYYY-MM-DD');
    if (holidaySet.has(iso) || holidaySetAnnual.has(iso.slice(5))) return 'holiday';
    return null;
  };

  let cursor = dayjs(p.start_date);
  const steps = [];
  let excluded = 0;

  if (unit === 'month' && p.day_type === 'calendar') {
    cursor = cursor.add(sign * amount, 'month');
  } else if (unit === 'day' && p.day_type === 'calendar') {
    cursor = cursor.add(sign * amount, 'day');
  } else {
    // business / legal / month-with-exclusion: iterate day by day
    let counted = 0;
    let guard = 0;
    // month units with exclusion: approximate months as counted business days? Keep day-based iteration for day units only;
    // for month units with holiday_exclusion we add calendar months then roll forward off excluded days.
    if (unit === 'month') {
      cursor = cursor.add(sign * amount, 'month');
      while (isExcluded(cursor) && guard++ < 30) {
        cursor = cursor.add(sign >= 0 ? 1 : -1, 'day');
        excluded++;
      }
    } else {
      cursor = cursor.add(sign, 'day'); // count starts the day after (or before) the start date
      while (counted < amount && guard++ < 10000) {
        const why = isExcluded(cursor);
        if (why) {
          excluded++;
          steps.push({ date: cursor.format('YYYY-MM-DD'), excluded: why });
        } else {
          counted++;
          steps.push({ date: cursor.format('YYYY-MM-DD'), counted });
        }
        cursor = cursor.add(sign, 'day');
      }
      cursor = cursor.subtract(sign >= 0 ? 1 : -1, 'day'); // cursor overshot by one
    }
  }
  return { end_date: cursor.format('YYYY-MM-DD'), steps, excluded_days: excluded };
}

module.exports = { computeDeadline, isWeekend, ALGERIAN_WEEKEND };

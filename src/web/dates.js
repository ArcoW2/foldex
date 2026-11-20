'use strict';
// Dates as every date column shows them (the setting dateFormat): Windows' short date and short time (`systemDate`,
// the host's pattern with the settings), or a pattern of your own, one of DatePresets or typed. A pattern as .NET's and
// Windows': yyyy yy, MMMM MMM MM M, dddd ddd dd d, HH H hh h, mm m, ss s, tt; 'text' in quotes and \x as they are;
// anything else as it is. Loaded by the window's page, a pane's page and the settings window.

let systemDate = '';   // Windows' short date and short time pattern (SettingsFile.Load)

// The patterns offered in the settings window, beside System.
const DatePresets = ['dd-MM-yyyy HH:mm', 'dd/MM/yyyy HH:mm', 'dd.MM.yyyy HH:mm', 'd-M-yyyy H:mm', 'yyyy-MM-dd HH:mm',
  'yyyy-MM-dd HH:mm:ss', 'MM/dd/yyyy h:mm tt', 'd MMM yyyy HH:mm', 'ddd d MMM yyyy HH:mm'];

const DateTokens = /'[^']*'|"[^"]*"|\\.|yyyy|yy|MMMM|MMM|MM|M|dddd|ddd|dd|d|HH|H|hh|h|mm|m|ss|s|tt/g;
// The names of months and days in the language of Windows, made when first needed.
const DateNameOptions = { MMMM: { month: 'long' }, MMM: { month: 'short' }, dddd: { weekday: 'long' }, ddd: { weekday: 'short' } };
const dateNames = {};
const dateName = (t, d) => (dateNames[t] ??= new Intl.DateTimeFormat(undefined, DateNameOptions[t])).format(d);

// A date (ms since 1970) in local time as `pattern` says.
function formatDateTime(ms, pattern) {
  const d = new Date(ms);
  const two = n => String(n).padStart(2, '0');
  const h12 = d.getHours() % 12 || 12;
  return pattern.replace(DateTokens, t => {
    switch (t) {
      case 'yyyy': return String(d.getFullYear()).padStart(4, '0');
      case 'yy': return two(d.getFullYear() % 100);
      case 'MMMM': case 'MMM': case 'dddd': case 'ddd': return dateName(t, d);
      case 'MM': return two(d.getMonth() + 1);
      case 'M': return String(d.getMonth() + 1);
      case 'dd': return two(d.getDate());
      case 'd': return String(d.getDate());
      case 'HH': return two(d.getHours());
      case 'H': return String(d.getHours());
      case 'hh': return two(h12);
      case 'h': return String(h12);
      case 'mm': return two(d.getMinutes());
      case 'm': return String(d.getMinutes());
      case 'ss': return two(d.getSeconds());
      case 's': return String(d.getSeconds());
      case 'tt': return d.getHours() < 12 ? 'AM' : 'PM';
    }
    return t[0] === '\\' ? t.slice(1) : t.slice(1, -1);   // quoted text, an escaped character
  });
}

// The pattern in use: yours, else Windows'.
const datePattern = values => values?.dateFormat || systemDate || 'yyyy-MM-dd HH:mm';

// A date as the date columns show it.
const shownDate = ms => formatDateTime(ms, datePattern(typeof settings === 'undefined' ? null : settings));

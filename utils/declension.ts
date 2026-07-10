// Best-effort Russian genitive for the "от <Автор>" byline.
//
// Russian declension is irregular (fleeting vowels, gendered surnames), so this
// is deliberately conservative: it declines given names by the regular rules and
// declines surnames ONLY when they carry an unambiguously masculine, declinable
// suffix (-ов/-ев/-ёв/-ин/-ын or adjectival -ский/-цкий/-ый/-ой). Anything it is
// not sure about is returned unchanged, so the output is never worse than the
// nominative form we showed before.

const VELAR_SIBILANT = 'гкхжшчщ';

const genitiveGivenName = (word: string): string => {
  const lower = word.toLowerCase();
  const last = lower.slice(-1);
  const prev = lower.slice(-2, -1);

  if (last === 'й') return word.slice(0, -1) + 'я';          // Сергей → Сергея, Андрей → Андрея
  if (last === 'ь') return word.slice(0, -1) + 'я';          // Игорь → Игоря
  if (last === 'я') return word.slice(0, -1) + 'и';          // Илья → Ильи, Мария → Марии
  if (last === 'а') return word.slice(0, -1) + (VELAR_SIBILANT.includes(prev) ? 'и' : 'ы'); // Никита → Никиты
  if (/[бвгдзклмнпрстфхц]/.test(last)) return word + 'а';    // Иван → Ивана, Александр → Александра
  return word; // vowels о/е/и/у/ю/ы/э and anything else: leave as-is (foreign/indeclinable)
};

const genitiveSurname = (word: string): string => {
  const lower = word.toLowerCase();
  const last2 = lower.slice(-2);

  if (['ов', 'ев', 'ёв', 'ин', 'ын'].includes(last2)) return word + 'а';       // Калинин → Калинина, Иванов → Иванова
  if (['ий', 'ый', 'ой'].includes(last2)) return word.slice(0, -2) + 'ого';     // Толстой → Толстого, Достоевский → Достоевского
  return word; // ambiguous / gendered (Сурконт, Смит, Шевченко): keep nominative to avoid wrong grammar
};

export const toGenitiveRu = (fullName: string): string => {
  const trimmed = (fullName || '').trim();
  if (!trimmed) return fullName;
  const parts = trimmed.split(/\s+/);
  // Heuristic: "Given Surname" (2 tokens). Otherwise decline only the first token.
  if (parts.length === 2) {
    return `${genitiveGivenName(parts[0])} ${genitiveSurname(parts[1])}`;
  }
  return [genitiveGivenName(parts[0]), ...parts.slice(1)].join(' ');
};

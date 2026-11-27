/* Display the seasonal calendar inline, using the same exceptions as reservations. */
(() => {
  const notice = document.getElementById('seasonNotice');
  const title = document.getElementById('seasonTitle');
  const action = document.getElementById('seasonAction');
  const dates = document.getElementById('seasonDates');
  const poster = document.getElementById('seasonPoster');

  fetch('content/popup.json', {cache: 'no-store'})
    .then(response => response.ok ? response.json() : null)
    .then(config => {
      if (!config?.enabled) return;
      const today = lisbonNow().date;
      if ((config.start_date && today < config.start_date) ||
          (config.end_date && today > config.end_date)) return;

      function render() {
        const en = document.documentElement.lang === 'en';
        title.textContent = (en ? config.title_en : config.title_pt) || config.title_pt;
        action.textContent = notice.open
          ? (en ? 'Hide hours' : 'Ocultar horários')
          : (en ? 'View hours' : 'Ver horários');
        poster.alt = (en ? config.image_alt_en : config.image_alt_pt) || title.textContent;

        const labels = en
          ? {regular: 'Regular hours', closed: 'Closed', lunch: 'Lunch closed', dinner: 'Dinner closed'}
          : {regular: 'Horário habitual', closed: 'Encerrado', lunch: 'Almoço encerrado', dinner: 'Jantar encerrado'};
        const entries = new Map(bookingCalendar.open_dates.map(date => [date, labels.regular]));
        for (const [date, sessions] of Object.entries(bookingCalendar.closed_sessions)) {
          if (sessions.length) entries.set(date, sessions.map(session => labels[session]).join(' · '));
        }
        for (const date of bookingCalendar.closed_dates) entries.set(date, labels.closed);
        const format = new Intl.DateTimeFormat(en ? 'en-GB' : 'pt-PT', {
          day: 'numeric', month: 'long', timeZone: 'UTC'
        });
        const items = [...entries.keys()].sort()
          .filter(date => (!config.start_date || date >= config.start_date) &&
            (!config.end_date || date <= config.end_date))
          .map(date => {
            const item = document.createElement('li');
            item.textContent = format.format(new Date(date)) + ' — ' + entries.get(date);
            return item;
          });
        dates.replaceChildren(...items);
        dates.hidden = !items.length;
      }

      if (typeof config.image === 'string' && /^assets\/[a-z0-9/_-]+\.(?:webp|png|jpe?g)$/i.test(config.image)) {
        poster.addEventListener('error', () => { poster.hidden = true; });
        poster.src = config.image;
        poster.hidden = false;
      }
      notice.addEventListener('toggle', render);
      document.getElementById('lang').addEventListener('click', render);
      bookingDataReady.then(render);
      render();
      notice.hidden = false;
    })
    .catch(() => { /* The homepage remains available without the seasonal notice. */ });
})();

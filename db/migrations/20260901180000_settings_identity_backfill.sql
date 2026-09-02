-- Correct a settings row written before the tax certificate was on hand.
--
-- `defaultSettings()` carries the right contact details, but the seed only
-- writes them when the table is empty — so an installation seeded earlier kept
-- the pre-correction e-mail and street name, and went on serving them in the
-- footer and the contact block of every page while /hukuk (which reads the
-- legal entity, not settings) showed the corrected ones. Two sources, two
-- answers, and the wrong one was the one customers were told to write to.
--
-- Deliberately narrow: each column is only touched while it still holds the
-- exact superseded value, so anything an owner has since typed themselves is
-- left alone, and running this twice changes nothing.

update public.settings
  set email = 'info@nextgenlab.com.tr'
  where id = 'main'
    and email in ('tuzla@laffogato.it', 'merhaba@laffogato.it');

update public.settings
  set address = 'Postane Mah. Atatürk Cad. No: 28 İç Kapı No: 1 (Menemenci Cumhur' || chr(8217) || 'un yanı), 34940 Tuzla / İstanbul'
  where id = 'main'
    and address like '%29 Ekim%';

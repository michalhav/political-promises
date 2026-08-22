# Hlášení bezpečnostních chyb

Díky, že to čtete dřív, než chybu zveřejníte.

## Kam ji nahlásit

Použijte **soukromé hlášení přímo na GitHubu**:

> [Security → Report a vulnerability](https://github.com/michalhav/political-promises/security/advisories/new)

Hlášení uvidí jen správce repozitáře. Není k tomu potřeba e-mail ani účet
kdekoli jinde.

**Nezakládejte na bezpečnostní chybu veřejné issue** ani ji nepopisujte
v pull requestu. Ne proto, že bychom ji chtěli tajit — ale proto, aby byl
čas ji opravit dřív, než ji někdo použije.

## Co od nás můžete čekat

| | |
| --- | --- |
| Potvrzení, že hlášení dorazilo | do 7 dnů |
| Vyjádření, jestli to bereme jako chybu | do 30 dnů |
| Zveřejnění po opravě | ano, včetně uvedení nálezce, pokud si to přeje |

Projekt dělá jeden člověk ve volném čase. Lhůty jsou psané tak, aby se daly
dodržet, ne aby dobře vypadaly.

## Co do rozsahu patří

- Aplikace v `src/` — redakční konzole, veřejná část, autentizace.
- Integritní pravidla: cokoli, čím jde obejít pravidlo čtyř očí, přepsat
  publikované hodnocení, smazat audit nebo vydat nepotvrzený návrh modelu za
  ověřený.
- Provenience dokumentů: cokoli, čím jde podvrhnout zdroj nebo citaci.

## Co do rozsahu nepatří

- Nálezy z automatických skenerů bez doloženého dopadu.
- Zranitelnosti ve vývojových závislostech, které se nedostanou do běhu
  aplikace. `drizzle-kit` například táhne zranitelný `esbuild`; je to nástroj
  pouštěný z příkazové řádky při vývoji, ne součást nasazené aplikace.
- Chybějící hlavičky nebo nastavení na nenasazené instanci — aplikace zatím
  nikde veřejně neběží.

## Známé chyby, na kterých se pracuje

Projekt je ve fázi před prvním nasazením a **nemá produkční instanci ani
uživatele**. Následující nálezy jsou popsané v
[docs/co-zbyva.md](./docs/co-zbyva.md) v části „Bezpečnostní nálezy z revize"
a opravují se. Hlásit je znovu není potřeba.

Že jsou popsané veřejně, je záměr: dokud nikde neběží produkce, je otevřený
seznam vlastních nedodělků poctivější než mlčení.

## Kryptografie a citlivé údaje

Projekt zpracovává jména veřejných činitelů, e-maily podatelů podnětů a otisky
jejich IP adres. Hlášení, která se týkají těchto tří skupin dat, mají přednost
před vším ostatním.

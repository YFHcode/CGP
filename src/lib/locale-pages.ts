import type { MetalSymbol } from '@/types';
import { SITE_URL } from './navigation';

/**
 * Localized landing pages for locales with demonstrated, unserved demand.
 *
 * These exist because Search Console showed real recurring queries in Dutch
 * ("zilverprijs grafiek 10 jaar"), Ukrainian ("ціна золота графік") and
 * German ("goldpreis euro") landing on English pages ranked 55-82 — i.e.
 * people looking for exactly what this site has, in a language it doesn't
 * speak.
 *
 * Scope is deliberately narrow: one focused page per locale, targeting the
 * specific intent observed, rather than a machine-translated mirror of the
 * whole site. Google treats bulk auto-translated pages published without
 * human review as spam, so breadth here would be a liability, not a win.
 * Each block below still needs a native speaker's read before it earns
 * trust — the figures are computed, but the prose is not native-written.
 */

export interface LocalePageConfig {
    /** URL segment and hreflang code. */
    locale: string;
    /** BCP-47 tag for the <html lang> attribute. */
    lang: string;
    /** Which metal this locale's observed demand is actually about. */
    metal: MetalSymbol;
    title: string;
    description: string;
    heading: string;
    intro: string;
    chartTitle: string;
    /** Label for the link back to the full English site. */
    englishLink: string;
    /** The English page this is the localized counterpart of. */
    canonicalEnglishPath: string;
    faq: { question: string; answer: string }[];
}

export const LOCALE_PAGES: LocalePageConfig[] = [
    {
        locale: 'nl',
        lang: 'nl',
        metal: 'XAG',
        title: 'Zilverprijs Grafiek — Actuele Zilverprijs per Ounce en Gram',
        description:
            'Actuele zilverprijs met historische grafieken van één week tot de volledige reeks, ' +
            'plus jaarrendementen en de zilverprijs per gram, ounce en kilo.',
        heading: 'Zilverprijs grafiek',
        intro:
            'De actuele zilverprijs per troy ounce en per gram, met historische grafieken vanaf ' +
            'één week tot de volledige beschikbare reeks. Alle cijfers komen uit onze eigen ' +
            'vastgelegde koersreeks.',
        chartTitle: 'Historische zilverkoersen',
        englishLink: 'Bekijk de volledige site in het Engels',
        canonicalEnglishPath: '/silver-price-history',
        faq: [
            {
                question: 'Wat is de zilverprijs vandaag?',
                answer:
                    'De actuele zilverprijs staat bovenaan deze pagina, in Amerikaanse dollar per ' +
                    'troy ounce en per gram. Een troy ounce is 31,1034768 gram.',
            },
            {
                question: 'Hoe bekijk ik de zilverprijs over 10 jaar?',
                answer:
                    'Gebruik de knoppen boven de grafiek om de periode te wijzigen — van 1 week tot ' +
                    'de volledige reeks die wij vastleggen.',
            },
            {
                question: 'Wat is zilver van 925 waard?',
                answer:
                    'Sterling zilver (925) bestaat voor 92,5% uit zuiver zilver, dus de smeltwaarde ' +
                    'is 92,5% van de zuivere zilverprijs bij hetzelfde gewicht.',
            },
        ],
    },
    {
        // URL segment is 'ua' (Ukraine), not 'uk' (the ISO 639-1 code for the
        // Ukrainian *language*, which `lang` correctly is). /uk was a genuine
        // collision: "gold price uk" search intent is British, and this page
        // was serving it Ukrainian-language content about gold. /uk is now a
        // dedicated English-language British page (src/app/uk/page.tsx);
        // this one moved to the unambiguous /ua instead.
        locale: 'ua',
        lang: 'uk',
        metal: 'XAU',
        title: 'Ціна золота — графік у доларах за унцію та грам',
        description:
            'Актуальна ціна золота з історичними графіками від одного тижня до повного архіву, ' +
            'а також ціна золота за грам, унцію та кілограм.',
        heading: 'Ціна золота: графік',
        intro:
            'Актуальна ціна золота за тройську унцію та за грам з історичними графіками — від ' +
            'одного тижня до повного доступного архіву. Усі цифри обчислені з нашого власного ' +
            'записаного ряду котирувань.',
        chartTitle: 'Історичні котирування золота',
        englishLink: 'Переглянути повний сайт англійською',
        canonicalEnglishPath: '/gold-price-history',
        faq: [
            {
                question: 'Яка ціна золота сьогодні?',
                answer:
                    'Поточна ціна золота вказана вгорі цієї сторінки — у доларах США за тройську ' +
                    'унцію та за грам. Тройська унція дорівнює 31,1034768 грама.',
            },
            {
                question: 'Як подивитися графік ціни золота за кілька років?',
                answer:
                    'Скористайтеся кнопками над графіком, щоб змінити період — від одного тижня до ' +
                    'усього доступного архіву.',
            },
            {
                question: 'Скільки коштує золото 585 проби за грам?',
                answer:
                    'Золото 585 проби містить 58,5% чистого золота, тому його вартість за грам ' +
                    'становить 58,5% від ціни чистого золота за грам.',
            },
        ],
    },
    {
        locale: 'de',
        lang: 'de',
        metal: 'XAU',
        title: 'Goldpreis in Euro — Aktueller Kurs pro Unze und Gramm',
        description:
            'Aktueller Goldpreis mit historischen Charts von einer Woche bis zum vollständigen ' +
            'Archiv, dazu der Goldpreis pro Gramm, Unze und Kilogramm.',
        heading: 'Goldpreis',
        intro:
            'Der aktuelle Goldpreis pro Feinunze und pro Gramm, mit historischen Charts von einer ' +
            'Woche bis zum vollständigen verfügbaren Archiv. Alle Zahlen stammen aus unserer ' +
            'eigenen aufgezeichneten Kursreihe.',
        chartTitle: 'Historische Goldkurse',
        englishLink: 'Die vollständige Seite auf Englisch ansehen',
        canonicalEnglishPath: '/gold-price-history',
        faq: [
            {
                question: 'Wie hoch ist der Goldpreis heute?',
                answer:
                    'Der aktuelle Goldpreis steht oben auf dieser Seite — in US-Dollar pro Feinunze ' +
                    'und pro Gramm. Eine Feinunze entspricht 31,1034768 Gramm.',
            },
            {
                question: 'Wie sehe ich den Goldpreis in Euro?',
                answer:
                    'Über die Währungsauswahl oben rechts lässt sich die Anzeige auf Euro umstellen; ' +
                    'alle Preise auf der Seite werden dann in Euro umgerechnet.',
            },
            {
                question: 'Was ist ein Gramm 585er Gold wert?',
                answer:
                    '585er Gold (14 Karat) besteht zu 58,5% aus reinem Gold, der Materialwert pro ' +
                    'Gramm beträgt also 58,5% des Feingoldpreises.',
            },
        ],
    },
];

export function findLocalePage(locale: string): LocalePageConfig | undefined {
    return LOCALE_PAGES.find((page) => page.locale === locale.toLowerCase());
}

/**
 * Builds the `alternates.languages` map for one page in a locale cluster —
 * either an English canonical page or one of its localized counterparts.
 *
 * The cluster is every LOCALE_PAGES entry that shares the same English
 * canonical path, not all of LOCALE_PAGES: /nl covers silver while /uk and
 * /de cover gold, so lumping all three together would cross-declare pages
 * about different metals as translations of each other. Centralized here
 * rather than re-filtered at each call site so a new locale only has to be
 * added to LOCALE_PAGES once — every page in its cluster picks it up
 * automatically instead of needing the same filter copied into a fourth or
 * fifth place.
 */
export function localeAlternates(canonicalEnglishPath: string): Record<string, string> {
    const cluster = LOCALE_PAGES.filter((page) => page.canonicalEnglishPath === canonicalEnglishPath);

    return {
        'x-default': `${SITE_URL}${canonicalEnglishPath}`,
        en: `${SITE_URL}${canonicalEnglishPath}`,
        ...Object.fromEntries(cluster.map((page) => [page.lang, `${SITE_URL}/${page.locale}`])),
    };
}

/**
 * Regional English cluster: /gold-price-today and /uk.
 *
 * Separate from localeAlternates because these are not translations. /uk is
 * English-language content aimed at British searchers — sterling pricing,
 * hallmark purities, VAT — while /gold-price-today serves everyone else. They
 * answer the same query ("gold price today") for different regions, which is
 * exactly the case hreflang exists for, and without it the two compete for one
 * intent instead of Google routing each audience to the right one.
 *
 * Neither page declared any alternate before this, so the pair was invisible
 * to Google as a cluster.
 */
export function regionalEnglishAlternates(): Record<string, string> {
    return {
        'x-default': `${SITE_URL}/gold-price-today`,
        en: `${SITE_URL}/gold-price-today`,
        'en-GB': `${SITE_URL}/uk`,
    };
}

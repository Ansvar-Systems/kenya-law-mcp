/**
 * AKN HTML parser for Kenyan legislation from new.kenyalaw.org
 *
 * Parses Akoma Ntoso (AKN) structured HTML served by the new Kenya Law platform
 * (new.kenyalaw.org). The site provides well-structured HTML with semantic classes:
 *   - akn-section: individual sections/articles (with id and data-eid attributes)
 *   - akn-part / akn-chapter: grouping containers
 *   - akn-paragraph / akn-subsection: sub-elements within sections
 *   - akn-num: section/paragraph numbering
 *   - akn-heading / h3: section titles
 *   - akn-p: paragraph text content
 *   - akn-intro / akn-content / akn-wrapUp: structural wrappers
 */

export interface ActIndexEntry {
  id: string;
  title: string;
  titleEn: string;
  shortName: string;
  status: 'in_force' | 'amended' | 'repealed' | 'partially_suspended' | 'not_yet_in_force';
  issuedDate: string;
  inForceDate: string;
  /** AKN URL on new.kenyalaw.org (e.g. https://new.kenyalaw.org/akn/ke/act/2019/24/) */
  url: string;
  /** Act number used in AKN URI (e.g. "24" for act/2019/24) */
  aknNumber: string;
  /** Year used in AKN URI */
  aknYear: string;
  description?: string;
}

export interface ParsedProvision {
  provision_ref: string;
  chapter?: string;
  section: string;
  title: string;
  content: string;
}

export interface ParsedDefinition {
  term: string;
  definition: string;
  source_provision?: string;
}

export interface ParsedAct {
  id: string;
  type: 'statute';
  title: string;
  title_en: string;
  short_name: string;
  status: 'in_force' | 'amended' | 'repealed' | 'partially_suspended' | 'not_yet_in_force';
  issued_date: string;
  in_force_date: string;
  url: string;
  description?: string;
  provisions: ParsedProvision[];
  definitions: ParsedDefinition[];
}

/**
 * Strip HTML tags and decode common entities, normalising whitespace.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Determine the chapter/part container for a section from its AKN id.
 *
 * AKN ids follow patterns like:
 *   part_I__sec_1       -> chapter = "Part I"
 *   chp_ONE__sec_1      -> chapter = "Chapter ONE"
 *   sec_1               -> chapter = undefined
 */
function extractChapter(sectionId: string): string | undefined {
  const partMatch = sectionId.match(/^part_([^_]+)__/);
  if (partMatch) return `Part ${partMatch[1]}`;

  const chpMatch = sectionId.match(/^chp_([^_]+)__/);
  if (chpMatch) return `Chapter ${chpMatch[1]}`;

  return undefined;
}

/**
 * Extract the section number from the h3 heading text.
 * Handles patterns like "1. Short title" or "25. Principles of data protection"
 */
function extractSectionNumber(heading: string): string | null {
  const match = heading.match(/^(\d+[A-Za-z]*)\.\s/);
  return match ? match[1] : null;
}

/**
 * Extract the section title from the h3 heading text.
 * Strips the leading number and period.
 */
function extractSectionTitle(heading: string): string {
  return heading.replace(/^\d+[A-Za-z]*\.\s*/, '').trim();
}

/**
 * Parse new.kenyalaw.org AKN HTML to extract provisions from a statute page.
 *
 * The HTML contains <section class="akn-section" id="..." data-eid="..."> elements.
 * Each section contains an <h3> with the section number and title, followed by
 * structural content using akn-intro, akn-paragraph, akn-subsection, akn-content,
 * akn-p, and akn-num elements.
 */
export function parseKenyaLawHtml(html: string, act: ActIndexEntry): ParsedAct {
  const provisions: ParsedProvision[] = [];
  const definitions: ParsedDefinition[] = [];

  // Extract individual akn-section elements using regex.
  // Pattern: <section class="akn-section" id="..." data-eid="...">...</section>
  // We split on section boundaries to capture each section's full content.
  const sectionPattern = /<section\s+class="akn-section"\s+id="([^"]+)"\s+data-eid="[^"]*">/g;
  const sectionStarts: { id: string; index: number }[] = [];
  let match: RegExpExecArray | null;

  while ((match = sectionPattern.exec(html)) !== null) {
    sectionStarts.push({ id: match[1], index: match.index });
  }

  for (let i = 0; i < sectionStarts.length; i++) {
    const start = sectionStarts[i];
    const endIndex = i + 1 < sectionStarts.length
      ? sectionStarts[i + 1].index
      : html.length;

    const sectionHtml = html.substring(start.index, endIndex);

    // Extract heading from <h3>...</h3>
    const headingMatch = sectionHtml.match(/<h3>([^<]+)<\/h3>/);
    if (!headingMatch) continue;

    const headingText = headingMatch[1].trim();
    const sectionNum = extractSectionNumber(headingText);
    if (!sectionNum) continue;

    const title = extractSectionTitle(headingText);
    const chapter = extractChapter(start.id);

    // For the provision reference, use "s" prefix for sections (standard for Acts),
    // "art" prefix only if the container id starts with "art"
    const isArticle = start.id.includes('__art_');
    const provisionRef = isArticle ? `art${sectionNum}` : `s${sectionNum}`;

    // Extract the full text content, stripping HTML tags
    // Remove the heading we already captured to avoid duplication
    const contentHtml = sectionHtml.replace(/<h3>[^<]*<\/h3>/, '');
    const content = stripHtml(contentHtml);

    if (content.length > 10) {
      provisions.push({
        provision_ref: provisionRef,
        chapter,
        section: sectionNum,
        title,
        content: content.substring(0, 12000), // Cap at 12K chars per section
      });
    }

    // Extract definitions from Section 2 (Interpretation) or similar definition sections
    if (title.toLowerCase().includes('interpretation') || title.toLowerCase().includes('definition')) {
      extractDefinitions(sectionHtml, provisionRef, definitions);
    }
  }

  return {
    id: act.id,
    type: 'statute',
    title: act.title,
    title_en: act.titleEn,
    short_name: act.shortName,
    status: act.status,
    issued_date: act.issuedDate,
    in_force_date: act.inForceDate,
    url: act.url,
    description: act.description,
    provisions,
    definitions,
  };
}

/**
 * Extract term definitions from an Interpretation section.
 * Definitions in AKN HTML appear as akn-p elements within akn-intro,
 * typically in the pattern: "term" means ...;
 */
function extractDefinitions(
  sectionHtml: string,
  sourceProvision: string,
  definitions: ParsedDefinition[],
): void {
  // Match patterns like: "term" means/includes definition text
  // In AKN HTML, each definition is typically a separate akn-p element
  const pElements = sectionHtml.match(/<span class="akn-p"[^>]*>[^<]*<\/span>/g) ?? [];

  for (const p of pElements) {
    const text = stripHtml(p);
    // Pattern: "term" means/includes definition;
    const defMatch = text.match(/^["\u201c]([^"\u201d]+)["\u201d]\s+(means|includes|has the meaning)\s+(.+)/i);
    if (defMatch) {
      const term = defMatch[1].trim();
      const definition = defMatch[3].replace(/;$/, '').trim();
      if (term.length > 0 && definition.length > 5) {
        definitions.push({
          term,
          definition,
          source_provision: sourceProvision,
        });
      }
    }
  }
}

/**
 * Pre-configured list of key Kenyan Acts to ingest.
 *
 * Source: new.kenyalaw.org (Akoma Ntoso HTML).
 * URLs use AKN URI pattern: /akn/ke/act/{year}/{number}/
 *
 * These are the most important Acts for cybersecurity, data protection,
 * and compliance use cases.
 */
export const KEY_KENYAN_ACTS: ActIndexEntry[] = [
  {
    id: 'data-protection-act-2019',
    title: 'Data Protection Act 2019',
    titleEn: 'Data Protection Act 2019',
    shortName: 'DPA 2019',
    status: 'in_force',
    issuedDate: '2019-11-08',
    inForceDate: '2019-11-25',
    url: 'https://new.kenyalaw.org/akn/ke/act/2019/24/',
    aknYear: '2019',
    aknNumber: '24',
    description: 'Comprehensive data protection law establishing the Office of the Data Protection Commissioner (ODPC)',
  },
  {
    id: 'computer-misuse-cybercrimes-act-2018',
    title: 'Computer Misuse and Cybercrimes Act 2018',
    titleEn: 'Computer Misuse and Cybercrimes Act 2018',
    shortName: 'CMCA 2018',
    status: 'partially_suspended',
    issuedDate: '2018-05-16',
    inForceDate: '2018-05-30',
    url: 'https://new.kenyalaw.org/akn/ke/act/2018/5/',
    aknYear: '2018',
    aknNumber: '5',
    description: 'Comprehensive cybercrime legislation; Sections 22, 23, 24, 27, and 53 suspended by High Court pending constitutional review',
  },
  {
    id: 'companies-act-2015',
    title: 'Companies Act 2015',
    titleEn: 'Companies Act 2015',
    shortName: 'Companies Act',
    status: 'in_force',
    issuedDate: '2015-09-11',
    inForceDate: '2015-09-11',
    url: 'https://new.kenyalaw.org/akn/ke/act/2015/17/',
    aknYear: '2015',
    aknNumber: '17',
    description: 'Modern company law framework replacing the Companies Act (Cap 486)',
  },
  {
    id: 'kenya-information-communications-act',
    title: 'Kenya Information and Communications Act',
    titleEn: 'Kenya Information and Communications Act',
    shortName: 'KICA',
    status: 'in_force',
    issuedDate: '1998-01-01',
    inForceDate: '1998-01-01',
    url: 'https://new.kenyalaw.org/akn/ke/act/1998/2/',
    aknYear: '1998',
    aknNumber: '2',
    description: 'Regulates telecommunications and ICT sector; establishes the Communications Authority of Kenya',
  },
  {
    id: 'consumer-protection-act-2012',
    title: 'Consumer Protection Act 2012',
    titleEn: 'Consumer Protection Act 2012',
    shortName: 'CPA 2012',
    status: 'in_force',
    issuedDate: '2012-12-31',
    inForceDate: '2012-12-31',
    url: 'https://new.kenyalaw.org/akn/ke/act/2012/46/',
    aknYear: '2012',
    aknNumber: '46',
    description: 'Consumer rights and fair trade practices legislation',
  },
  {
    id: 'competition-act-2010',
    title: 'Competition Act 2010',
    titleEn: 'Competition Act 2010',
    shortName: 'Competition Act',
    status: 'in_force',
    issuedDate: '2010-12-24',
    inForceDate: '2011-08-01',
    url: 'https://new.kenyalaw.org/akn/ke/act/2010/12/',
    aknYear: '2010',
    aknNumber: '12',
    description: 'Competition and antitrust legislation; establishes the Competition Authority of Kenya',
  },
  {
    id: 'national-payment-system-act-2011',
    title: 'National Payment System Act 2011',
    titleEn: 'National Payment System Act 2011',
    shortName: 'NPS Act',
    status: 'in_force',
    issuedDate: '2011-12-31',
    inForceDate: '2011-12-31',
    url: 'https://new.kenyalaw.org/akn/ke/act/2011/39/',
    aknYear: '2011',
    aknNumber: '39',
    description: 'Regulation of payment systems including mobile money (M-Pesa)',
  },
  {
    id: 'central-bank-of-kenya-act',
    title: 'Central Bank of Kenya Act',
    titleEn: 'Central Bank of Kenya Act',
    shortName: 'CBK Act',
    status: 'in_force',
    issuedDate: '1966-01-01',
    inForceDate: '1966-01-01',
    url: 'https://new.kenyalaw.org/akn/ke/act/1966/15/',
    aknYear: '1966',
    aknNumber: '15',
    description: 'Establishes and regulates the Central Bank of Kenya',
  },
  {
    id: 'constitution-of-kenya-2010',
    title: 'Constitution of Kenya 2010',
    titleEn: 'Constitution of Kenya 2010',
    shortName: 'Constitution',
    status: 'in_force',
    issuedDate: '2010-08-27',
    inForceDate: '2010-08-27',
    url: 'https://new.kenyalaw.org/akn/ke/act/2010/constitution/',
    aknYear: '2010',
    aknNumber: 'constitution',
    description: 'Supreme law of Kenya; Article 31 guarantees the right to privacy; Article 35 guarantees the right of access to information',
  },
  {
    id: 'evidence-act',
    title: 'Evidence Act',
    titleEn: 'Evidence Act',
    shortName: 'Evidence Act',
    status: 'in_force',
    issuedDate: '1963-01-01',
    inForceDate: '1963-01-01',
    url: 'https://new.kenyalaw.org/akn/ke/act/1963/46/',
    aknYear: '1963',
    aknNumber: '46',
    description: 'Law of evidence including provisions on electronic evidence and computer-generated records',
  },
  {
    id: 'proceeds-of-crime-aml-act-2009',
    title: 'Proceeds of Crime and Anti-Money Laundering Act 2009',
    titleEn: 'Proceeds of Crime and Anti-Money Laundering Act 2009',
    shortName: 'POCAMLA',
    status: 'in_force',
    issuedDate: '2009-12-31',
    inForceDate: '2010-06-28',
    url: 'https://new.kenyalaw.org/akn/ke/act/2009/9/',
    aknYear: '2009',
    aknNumber: '9',
    description: 'Anti-money laundering legislation establishing the Financial Reporting Centre (FRC)',
  },
];

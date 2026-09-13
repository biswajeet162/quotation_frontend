/** Public marketing site content sourced from Asian Procurement Service company profile. */

export interface ProductCategory {
  id: string;
  title: string;
  summary: string;
  items: string[];
}

export interface PartnerBrand {
  name: string;
  group: 'transmission' | 'bearings' | 'pneumatics' | 'lubricants';
}

export const COMPANY = {
  name: 'Asian Procurement Service',
  shortName: 'APS',
  tagline: 'Industrial parts. Reliable supply. India-wide reach.',
  supporting:
    'We source and supply power transmission, bearings, pumps, seals, and lubricants for plants that cannot afford downtime.',
  address: 'Near Roquette India Private Limited, Fulsunga, Rudrapur, Uttarakhand, 263153 India',
  phones: ['79838 93006', '92866 30357'],
  email: 'admin@asianproc.com',
  domainHint: 'asiangrok.com',
} as const;

export const ABOUT_POINTS = [
  {
    title: 'Procurement partners',
    body: 'We connect factories with trusted industrial brands — from belts and couplings to bearings, pumps, and precision seals.',
  },
  {
    title: 'Stock that keeps lines running',
    body: 'Fast response on critical spares so maintenance teams can plan shutdowns with confidence, not guesswork.',
  },
  {
    title: 'Rooted in Rudrapur',
    body: 'Based in Uttarakhand’s industrial belt, we serve plants across India with grounded, relationship-first service.',
  },
] as const;

export const PRODUCT_CATEGORIES: ProductCategory[] = [
  {
    id: 'transmission',
    title: 'Power transmission',
    summary: 'Belts, pulleys, chains, sprockets, couplings, gearboxes, and shafts.',
    items: [
      'V-belts, timing & conveyor belts',
      'Pulleys & taper bushes',
      'Couplings & universal joints',
      'Chain & sprocket drives',
      'SMSR & worm gearboxes',
      'Transmission shafts',
    ],
  },
  {
    id: 'pumps',
    title: 'Industrial pumps & spares',
    summary: 'End-suction, submersible, mud, and vertical inline pump solutions.',
    items: [
      'End suction (back pullout)',
      'Wastewater submersible',
      'Self-priming mud pumps',
      'Vertical inline & multistage',
      'Pump spares & seals',
    ],
  },
  {
    id: 'bearings',
    title: 'Rolling bearings',
    summary: 'Deep groove, taper, spherical, needle, precision, and specialty bearings.',
    items: [
      'Ball & taper roller',
      'Angular contact & cylindrical',
      'Spherical & needle rollers',
      'Slewing & hybrid bearings',
      'Cam followers & track rollers',
    ],
  },
  {
    id: 'linear',
    title: 'Linear & housings',
    summary: 'Linear guides, bushings, actuators, pillow blocks, and lock hardware.',
    items: [
      'Linear bush bearings',
      'Cross & V-roller guides',
      'Ball screws & actuators',
      'Pillow & plumber blocks',
      'Lock nuts, sleeves & end caps',
    ],
  },
  {
    id: 'pneumatics',
    title: 'Pneumatics & motion',
    summary: 'Cylinders, valves, air bellows, and polyurethane tubing.',
    items: ['Pneumatic cylinders', 'Solenoid valves (SOV)', 'Air bellows', 'PU tubes'],
  },
  {
    id: 'seals-lubes',
    title: 'Seals, tools & lubricants',
    summary: 'Oil seals, O-rings, condition-monitoring tools, and industrial greases.',
    items: [
      'Oil seals, U-seals, O-rings',
      'Pullers & bearing heaters',
      'Grease guns & IR tools',
      'Timken, SKF, Klüber, THK, Mosil',
    ],
  },
];

export const PARTNER_BRANDS: PartnerBrand[] = [
  { name: 'JK Fenner', group: 'transmission' },
  { name: 'Gates', group: 'transmission' },
  { name: 'Megadyne', group: 'transmission' },
  { name: 'Lovejoy', group: 'transmission' },
  { name: 'Dunlop', group: 'transmission' },
  { name: 'Continental ContiTech', group: 'transmission' },
  { name: 'Mitsuboshi', group: 'transmission' },
  { name: 'Diamond Chain', group: 'transmission' },
  { name: 'Bando', group: 'transmission' },
  { name: 'KTR', group: 'transmission' },
  { name: 'SKF', group: 'bearings' },
  { name: 'FAG / Schaeffler', group: 'bearings' },
  { name: 'Timken', group: 'bearings' },
  { name: 'NSK', group: 'bearings' },
  { name: 'NTN', group: 'bearings' },
  { name: 'Koyo', group: 'bearings' },
  { name: 'IKO', group: 'bearings' },
  { name: 'RBC Bearings', group: 'bearings' },
  { name: 'IMI Norgren', group: 'pneumatics' },
  { name: 'IMI Herion', group: 'pneumatics' },
  { name: 'Klüber', group: 'lubricants' },
  { name: 'Mosil', group: 'lubricants' },
  { name: 'THK', group: 'lubricants' },
];

export const CAPABILITIES = [
  { label: 'Power transmission', detail: 'Belts to gearboxes' },
  { label: 'Bearings & housings', detail: 'OEM-grade supply' },
  { label: 'Pumps & fluid handling', detail: 'Industrial & civil' },
  { label: 'Seals & lubricants', detail: 'Maintenance ready' },
] as const;

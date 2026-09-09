/**
 * Official Algerian wilaya registry (58 wilayas since the 2019 administrative
 * reorganisation — Law n° 19-12 of 6 June 2019 created wilayas 49→58).
 * Population left NULL: the application must not invent official statistics.
 * Sources/verification must be maintained by administrators from official data.
 *
 * Region is a broad organisational grouping only (not an official subdivision):
 * Centre / Est / Ouest / Sud.
 */
const WILAYAS = [
  ['01', 'Adrar', 'أدرار', 'Sud'],
  ['02', 'Chlef', 'الشلف', 'Ouest'],
  ['03', 'Laghouat', 'الأغواط', 'Sud'],
  ['04', 'Oum El Bouaghi', 'أم البواقي', 'Est'],
  ['05', 'Batna', 'باتنة', 'Est'],
  ['06', 'Béjaïa', 'بجاية', 'Est'],
  ['07', 'Biskra', 'بسكرة', 'Sud'],
  ['08', 'Béchar', 'بشار', 'Sud'],
  ['09', 'Blida', 'البليدة', 'Centre'],
  ['10', 'Bouira', 'البويرة', 'Centre'],
  ['11', 'Tamanrasset', 'تمنراست', 'Sud'],
  ['12', 'Tébessa', 'تبسة', 'Est'],
  ['13', 'Tlemcen', 'تلمسان', 'Ouest'],
  ['14', 'Tiaret', 'تيارت', 'Ouest'],
  ['15', 'Tizi Ouzou', 'تيزي وزو', 'Centre'],
  ['16', 'Alger', 'الجزائر', 'Centre'],
  ['17', 'Djelfa', 'الجلفة', 'Sud'],
  ['18', 'Jijel', 'جيجل', 'Est'],
  ['19', 'Sétif', 'سطيف', 'Est'],
  ['20', 'Saïda', 'سعيدة', 'Ouest'],
  ['21', 'Skikda', 'سكيكدة', 'Est'],
  ['22', 'Sidi Bel Abbès', 'سيدي بلعباس', 'Ouest'],
  ['23', 'Annaba', 'عنابة', 'Est'],
  ['24', 'Guelma', 'قالمة', 'Est'],
  ['25', 'Constantine', 'قسنطينة', 'Est'],
  ['26', 'Médéa', 'المدية', 'Centre'],
  ['27', 'Mostaganem', 'مستغانم', 'Ouest'],
  ['28', "M'Sila", 'المسيلة', 'Est'],
  ['29', 'Mascara', 'معسكر', 'Ouest'],
  ['30', 'Ouargla', 'ورقلة', 'Sud'],
  ['31', 'Oran', 'وهران', 'Ouest'],
  ['32', 'El Bayadh', 'البيض', 'Sud'],
  ['33', 'Illizi', 'إليزي', 'Sud'],
  ['34', 'Bordj Bou Arréridj', 'برج بوعريريج', 'Est'],
  ['35', 'Boumerdès', 'بومرداس', 'Centre'],
  ['36', 'El Tarf', 'الطارف', 'Est'],
  ['37', 'Tindouf', 'تندوف', 'Sud'],
  ['38', 'Tissemsilt', 'تيسمسيلت', 'Ouest'],
  ['39', 'El Oued', 'الوادي', 'Sud'],
  ['40', 'Khenchela', 'خنشلة', 'Est'],
  ['41', 'Souk Ahras', 'سوق أهراس', 'Est'],
  ['42', 'Tipaza', 'تيبازة', 'Centre'],
  ['43', 'Mila', 'ميلة', 'Est'],
  ['44', "Aïn Defla", 'عين الدفلى', 'Centre'],
  ['45', 'Naâma', 'النعامة', 'Sud'],
  ['46', "Aïn Témouchent", 'عين تموشنت', 'Ouest'],
  ['47', 'Ghardaïa', 'غرداية', 'Sud'],
  ['48', 'Relizane', 'غليزان', 'Ouest'],
  ['49', 'Timimoun', 'تيميمون', 'Sud'],
  ['50', 'Bordj Badji Mokhtar', 'برج باجي مختار', 'Sud'],
  ['51', 'Ouled Djellal', 'أولاد جلال', 'Sud'],
  ['52', 'Béni Abbès', 'بني عباس', 'Sud'],
  ['53', 'In Salah', 'عين صالح', 'Sud'],
  ['54', 'In Guezzam', 'عين قزام', 'Sud'],
  ['55', 'Touggourt', 'تقرت', 'Sud'],
  ['56', 'Djanet', 'جانت', 'Sud'],
  ['57', "El M'Ghair", 'المغير', 'Sud'],
  ['58', 'El Menia', 'المنورة', 'Sud']
];

/**
 * Configurable court types — matching the Algerian judicial organization
 * (ordinary / administrative / commercial / conflict jurisdictions).
 * Extensible by administrators (Settings → Court types).
 */
const COURT_TYPES = [
  ['tribunal', 'محكمة', 'Tribunal', 'ordinary', 1, 'Juridiction de premier degré de l\'ordre judiciaire'],
  ['cour', 'مجلس قضائي', 'Cour (de justice)', 'ordinary', 2, 'Juridiction d\'appel de l\'ordre judiciaire'],
  ['cour_assises', 'محكمة الجنايات', 'Cour d\'assises', 'ordinary', 2, 'Formation criminelle (selon textes en vigueur)'],
  ['cour_supreme', 'المحكمة العليا', 'Cour suprême', 'ordinary', 3, 'Juridiction de cassation — ordre judiciaire'],
  ['tribunal_administratif', 'المحكمة الإدارية', 'Tribunal administratif', 'administrative', 1, 'Premier degré — ordre administratif'],
  ['cour_administrative_appel', 'المحكمة الإدارية للاستئناف', "Cour administrative d'appel", 'administrative', 2, 'Appel — ordre administratif'],
  ['conseil_etat', 'مجلس الدولة', "Conseil d'État", 'administrative', 3, 'Juridiction suprême — ordre administratif'],
  ['tribunal_commerce', 'المحكمة التجارية المتخصصة', 'Tribunal de commerce spécialisé', 'commercial', 1, 'Juridiction commerciale spécialisée (selon textes)'],
  ['pole_penal', 'القطب الجزائي', 'Pôle pénal', 'ordinary', 1, 'Pôle judiciaire pénal spécialisé (selon textes)'],
  ['tribunal_conflits', 'محكمة تنازع الاختصاص', 'Tribunal des conflits', 'conflict', 3, 'Règlement des conflits de compétence']
];

/**
 * Illustrative judicial entities. Deliberately marked verification_status='unverified':
 * the judicial map must be completed/verified by administrators from official sources
 * (Ministry of Justice directory). Nothing here should be treated as official data.
 * [key, type_code, name_ar, name_fr, wilaya_code, municipality, parent_key|null, verification_status]
 */
const JUDICIAL_ENTITIES = [
  ['cour_supreme', 'cour_supreme', 'المحكمة العليا', 'Cour suprême', '16', 'Alger Centre', null, 'unverified'],
  ['conseil_etat', 'conseil_etat', 'مجلس الدولة', "Conseil d'État", '16', 'Alger Centre', null, 'unverified'],
  ['tribunal_conflits', 'tribunal_conflits', 'محكمة تنازع الاختصاص', 'Tribunal des conflits', '16', 'Alger', null, 'unverified'],
  ['cour_alger', 'cour', 'المجلس القضائي للجزائر', "Cour d'Alger", '16', 'Alger', null, 'unverified'],
  ['trib_sidi_mhamed', 'tribunal', 'محكمة سيدي امحمد', "Tribunal de Sidi M'Hamed", '16', "Sidi M'Hamed", 'cour_alger', 'unverified'],
  ['trib_bir_mourad', 'tribunal', 'محكمة بئر مراد رايس', 'Tribunal de Bir Mourad Raïs', '16', 'Bir Mourad Raïs', 'cour_alger', 'unverified'],
  ['ta_alger', 'tribunal_administratif', 'المحكمة الإدارية للجزائر', "Tribunal administratif d'Alger", '16', 'Alger', null, 'unverified'],
  ['tcom_alger', 'tribunal_commerce', 'المحكمة التجارية المتخصصة للجزائر', "Tribunal de commerce spécialisé d'Alger", '16', 'Alger', null, 'unverified'],
  ['cour_oran', 'cour', 'المجلس القضائي لوهران', "Cour d'Oran", '31', 'Oran', null, 'unverified'],
  ['trib_oran', 'tribunal', 'محكمة وهران', "Tribunal d'Oran", '31', 'Oran', 'cour_oran', 'unverified'],
  ['cour_constantine', 'cour', 'المجلس القضائي لقسنطينة', 'Cour de Constantine', '25', 'Constantine', null, 'unverified'],
  ['trib_constantine', 'tribunal', 'محكمة قسنطينة', 'Tribunal de Constantine', '25', 'Constantine', 'cour_constantine', 'unverified']
];

/**
 * Chambers/sections are configurable per court: they vary between jurisdictions.
 * The entries below follow the module's documented example (Tribunal de Sidi M'Hamed)
 * and are flagged 'unverified' — must be confirmed against each court's official
 * organisation before professional use.
 */
const CHAMBERS = {
  trib_sidi_mhamed: [
    ['الغرفة المدنية', 'Chambre civile', 'civil'],
    ['غرفة شؤون الأسرة', 'Chambre famille / statut personnel', 'family'],
    ['الغرفة الجزائية', 'Chambre pénale', 'criminal'],
    ['الغرفة التجارية', 'Chambre commerciale', 'commercial'],
    ['الغرفة الاجتماعية', 'Chambre sociale', 'social'],
    ['غرفة الاستعجالات', 'Référé / urgences', 'urgent']
  ]
};

module.exports = { WILAYAS, COURT_TYPES, JUDICIAL_ENTITIES, CHAMBERS };

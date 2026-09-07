/* Hebrew name transliteration for Mi Shebeirach cards.
 * Strategy: a dictionary of common Hebrew names (accurate) + a phonetic
 * fallback for anything not in it. The result is always shown to the user in
 * an EDITABLE field, because no automatic transliteration is perfect — this
 * gets ~95% right and lets a person fix the rest before the gabbai reads it.
 * Exposes window.toHebrew(englishText).
 */
(function(){
  // ── Dictionary: lowercase English (and common spellings) → Hebrew ──
  var DICT = {
    // connectors
    'ben':'בן','bat':'בת','bas':'בת','ve':'ו','v':'ו','the':'',
    // ── male names ──
    'avraham':'אברהם','abraham':'אברהם','avrohom':'אברהם','avrum':'אברום','abe':'אייב',
    'yitzchak':'יצחק','yitzchok':'יצחק','isaac':'יצחק','itzik':'איציק',
    'yaakov':'יעקב','yaacov':'יעקב','yankel':'יאנקל','jacob':'יעקב','kobi':'קובי',
    'moshe':'משה','moishe':'משה','moses':'משה','moss':'משה',
    'aharon':'אהרן','aaron':'אהרן','aron':'אהרן','arele':'אהרל\'ה',
    'dovid':'דוד','david':'דוד','dovi':'דובי',
    'shlomo':'שלמה','solomon':'שלמה','shloime':'שלמה','shloimy':'שלמה',
    'yosef':'יוסף','yossef':'יוסף','yosi':'יוסי','yossi':'יוסי','joseph':'יוסף','joe':'יוסף',
    'shmuel':'שמואל','samuel':'שמואל','shmuli':'שמואל','sam':'שמואל',
    'binyamin':'בנימין','benjamin':'בנימין','benny':'בני','ben-zion':'בן ציון','benzion':'בן ציון',
    'yehuda':'יהודה','judah':'יהודה','yehudah':'יהודה','leib':'לייב','leibel':'לייבל',
    'menachem':'מנחם','mendel':'מענדל','mendy':'מנדי','mendle':'מענדל',
    'nachman':'נחמן','nachum':'נחום','nochum':'נחום',
    'naftali':'נפתלי','naphtali':'נפתלי','tuli':'טולי',
    'shimon':'שמעון','simon':'שמעון','shimshon':'שמשון','samson':'שמשון',
    'reuven':'ראובן','reuben':'ראובן','ruby':'ראובן',
    'levi':'לוי','leyvi':'לוי','levy':'לוי',
    'yissachar':'יששכר','zevulun':'זבולון','zevulon':'זבולון',
    'gad':'גד','asher':'אשר','dan':'דן',
    'eliezer':'אליעזר','lazer':'לייזער','elazar':'אלעזר','eleazar':'אלעזר',
    'eliyahu':'אליהו','eliahu':'אליהו','elijah':'אליהו','eli':'אלי',
    'yeshaya':'ישעיה','yeshayahu':'ישעיהו','isaiah':'ישעיהו',
    'yirmiyahu':'ירמיהו','jeremiah':'ירמיהו',
    'yechezkel':'יחזקאל','ezekiel':'יחזקאל','chatzkel':'חצקל',
    'daniel':'דניאל','doniel':'דניאל','danny':'דני',
    'chaim':'חיים','haim':'חיים','chaimke':'חיימקה','hyman':'חיים',
    'baruch':'ברוך','boruch':'ברוך','baruh':'ברוך',
    'gershon':'גרשון','gershom':'גרשם',
    'yechiel':'יחיאל','michel':'מיכל','michael':'מיכאל','micha':'מיכה','mike':'מיכאל',
    'gavriel':'גבריאל','gabriel':'גבריאל','gabi':'גבי',
    'raphael':'רפאל','refael':'רפאל','rafi':'רפי',
    'uriel':'אוריאל','uri':'אורי','ori':'אורי',
    'ariel':'אריאל','ari':'ארי','arye':'אריה','aryeh':'אריה','arie':'אריה',
    'dov':'דוב','ber':'בער','dovber':'דובער','berel':'בערל',
    'zvi':'צבי','tzvi':'צבי','hersh':'הירש','hershel':'הרשל','herschel':'הרשל','harry':'צבי',
    'yaakov-yosef':'יעקב יוסף','tzvi-hirsch':'צבי הירש',
    'shraga':'שרגא','feivel':'פייביל','feivish':'פייביש','philip':'שרגא',
    'yoel':'יואל','joel':'יואל','yoely':'יואלי',
    'meir':'מאיר','meyer':'מאיר','mayer':'מאיר',
    'mordechai':'מרדכי','mordche':'מרדכי','motty':'מוטי','motti':'מוטי','max':'מרדכי','marcus':'מרדכי',
    'pinchas':'פנחס','pinchos':'פנחס','pinny':'פיני','phineas':'פנחס',
    'shabtai':'שבתי','shabsai':'שבתי',
    'tuvia':'טוביה','tovia':'טוביה','tevye':'טוביה',
    'yona':'יונה','yonah':'יונה','jonah':'יונה','yoni':'יוני','yonatan':'יונתן','jonathan':'יונתן','nosson':'נתן','nathan':'נתן','natan':'נתן',
    'shaul':'שאול','saul':'שאול','sholom':'שלום','shalom':'שלום','sholom':'שלום',
    'zalman':'זלמן','zalmen':'זלמן','shneur':'שניאור','schneur':'שניאור',
    'kalman':'קלמן','kalonymus':'קלונימוס',
    'yekusiel':'יקותיאל','elimelech':'אלימלך','melech':'מלך',
    'avigdor':'אביגדור','avner':'אבנר','abner':'אבנר',
    'yehoshua':'יהושע','joshua':'יהושע','shua':'שוע','heshy':'יהושע',
    'kalev':'כלב','caleb':'כלב','ephraim':'אפרים','efraim':'אפרים','froike':'פרוֹיקה',
    'menashe':'מנשה','manasseh':'מנשה',
    'yissa':'','sinai':'סיני','matisyahu':'מתתיהו','matthew':'מתתיהו','mattis':'מתתיהו',
    'noach':'נח','noah':'נח','naftoli':'נפתלי',
    'yerachmiel':'ירחמיאל','simcha':'שמחה','sender':'סענדר','alexander':'אלכסנדר','alex':'אלכסנדר',
    'yitzchok-meir':'יצחק מאיר','avraham-yitzchak':'אברהם יצחק',
    // ── female names ──
    'sarah':'שרה','sara':'שרה','sori':'שׂרה','surie':'שרה','surah':'שרה',
    'rivka':'רבקה','rivkah':'רבקה','rebecca':'רבקה','riva':'ריבה','rifky':'רבקה',
    'rachel':'רחל','ruchel':'רחל','rochel':'רחל','ruchie':'רחל',
    'leah':'לאה','leia':'לאה','lea':'לאה','laya':'לאה',
    'miriam':'מרים','miri':'מירי','mimi':'מירים','marion':'מרים','mary':'מרים',
    'esther':'אסתר','ester':'אסתר','esti':'אסתי','etty':'אסתי','estee':'אסתי',
    'chana':'חנה','chanah':'חנה','hannah':'חנה','hana':'חנה','anne':'חנה','ann':'חנה','anna':'חנה',
    'devora':'דבורה','devorah':'דבורה','deborah':'דבורה','debby':'דבורה','dvora':'דבורה',
    'shifra':'שפרה','shprintza':'שפרינצה',
    'yael':'יעל','yaffa':'יפה','yaffe':'יפה','feige':'פייגא','feigy':'פייגי',
    'batya':'בתיה','basya':'בתיה','bracha':'ברכה','brocha':'ברכה',
    'chaya':'חיה','chaia':'חיה','chayale':'חיהלה',
    'gittel':'גיטל','gitty':'גיטי','gita':'גיטה',
    'faiga':'פייגא','fraida':'פריידא','fraidy':'פריידי','frayda':'פריידא',
    'golda':'גולדה','goldie':'גולדה','gold':'גולדה',
    'henya':'העניא','hinda':'הינדא','hindy':'הינדי',
    'yehudis':'יהודית','yehudit':'יהודית','judith':'יהודית','judy':'יהודית',
    'malka':'מלכה','malky':'מלכי','malkah':'מלכה','queenie':'מלכה',
    'nechama':'נחמה','nechamie':'נחמה',
    'peral':'פערל','perel':'פערל','pearl':'פערל','pessy':'פסי','pesha':'פעשא',
    'raizel':'רייזל','raizy':'רייזי','rose':'רייזל','roiza':'רויזא','shoshana':'שושנה','shoshy':'שושנה','susan':'שושנה',
    'rikel':'ריקל','ruth':'רות','rus':'רות','rut':'רות',
    'suri':'שרה','shaindel':'שיינדל','shaindy':'שיינדי','shayna':'שיינא',
    'tova':'טובה','tovah':'טובה','toby':'טובה','tzirel':'צירל','tziri':'צירל',
    'tzipora':'ציפורה','tziporah':'ציפורה','tzippy':'ציפי','zipporah':'ציפורה',
    'yenta':'יענטא','yente':'יענטא','yittel':'איטל','ita':'איטא','itty':'איטי',
    'zlata':'זלאטא','zelda':'זלדה','elka':'עלקא','elke':'עלקא',
    ' chavi':'חוי','chavie':'חוי','chavy':'חוי','avigail':'אביגיל','abigail':'אביגיל','gali':'גלי',
    'liba':'ליבא','libby':'ליבא','liba-':'ליבא','baila':'ביילא','bayla':'ביילא','beila':'ביילא',
    'kayla':'קיילא','kaila':'קיילא','keila':'קיילא','mindy':'מינדל','mindel':'מינדל',
    'rechy':'רחל','ricky':'רבקה','sima':'סימה','simi':'סימי','yocheved':'יוכבד','yochi':'יוכבד'
  };

  // ── Phonetic fallback for names not in the dictionary ──
  // Rough English→Hebrew by sound. Good enough to seed an editable field.
  function phonetic(w){
    w = w.toLowerCase().replace(/[^a-z]/g,'');
    if(!w) return '';
    var out = '';
    var i = 0;
    var vowelStart = /^[aeiou]/.test(w);
    while(i < w.length){
      var two = w.substr(i,2), three = w.substr(i,3);
      if(three === 'tch'){ out+='ץ'; i+=3; continue; }
      if(two==='sh'){ out+='ש'; i+=2; continue; }
      if(two==='ch'||two==='kh'){ out+='ח'; i+=2; continue; }
      if(two==='tz'||two==='ts'){ out+='צ'; i+=2; continue; }
      if(two==='ph'){ out+='פ'; i+=2; continue; }
      if(two==='th'){ out+='ת'; i+=2; continue; }
      if(two==='ck'){ out+='ק'; i+=2; continue; }
      var c = w[i];
      switch(c){
        case 'a': out += (i===0? 'א':''); break;
        case 'e': out += (i===0? 'א':''); break;
        case 'i': out += (i===0? 'אי':'י'); break;
        case 'o': out += (i===0? 'או':'ו'); break;
        case 'u': out += (i===0? 'או':'ו'); break;
        case 'y': out += (i===0? 'י':'י'); break;
        case 'b': out+='ב'; break;  case 'c': out+='ק'; break;
        case 'd': out+='ד'; break;  case 'f': out+='פ'; break;
        case 'g': out+='ג'; break;  case 'h': out+='ה'; break;
        case 'j': out+='\'ג'; break; case 'k': out+='ק'; break;
        case 'l': out+='ל'; break;  case 'm': out+='מ'; break;
        case 'n': out+='נ'; break;  case 'p': out+='פ'; break;
        case 'q': out+='ק'; break;  case 'r': out+='ר'; break;
        case 's': out+='ס'; break;  case 't': out+='ט'; break;
        case 'v': out+='ו'; break;  case 'w': out+='ו'; break;
        case 'x': out+='קס'; break; case 'z': out+='ז'; break;
      }
      i++;
    }
    // Final-letter forms (sofit)
    out = out.replace(/מ$/,'ם').replace(/נ$/,'ן').replace(/צ$/,'ץ').replace(/פ$/,'ף').replace(/כ$/,'ך');
    return out;
  }

  function convertWord(word){
    var key = word.toLowerCase().replace(/[.’']/g,'').trim();
    if(key === '') return '';
    if(Object.prototype.hasOwnProperty.call(DICT, key)) return DICT[key];
    // try without trailing punctuation / possessive
    if(Object.prototype.hasOwnProperty.call(DICT, key.replace(/[^a-z-]/g,''))) return DICT[key.replace(/[^a-z-]/g,'')];
    return phonetic(word);
  }

  window.toHebrew = function(text){
    if(!text) return '';
    return String(text).trim().split(/\s+/).map(convertWord).filter(Boolean).join(' ');
  };
  window.HEBREW_HAS = function(word){ return Object.prototype.hasOwnProperty.call(DICT, String(word||'').toLowerCase().trim()); };
})();

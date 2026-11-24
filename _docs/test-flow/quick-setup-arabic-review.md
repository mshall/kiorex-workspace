# Quick setup: Arabic strings for native review

Written by the engineer (not a native copywriter). Columns: key, English source, Arabic as shipped, a blank Review column for the reviewer's correction. Brand names stay transliterated as elsewhere in the apps (كيوريكس, كيورلي). Generated from the locale files and the `setup-strings.ts` files on 24 Nov 2026; regenerate rather than hand-editing the first three columns.

Tone rules used: second person, plain Egyptian-friendly Modern Standard Arabic, verbs in the imperative for buttons, numerals as Western digits wrapped by the app's numeral setting.

## Questions for the reviewer

1. Brand: "Kiorex" in the checklist is now written كيوريكس (the bottom nav already does); Pharmacy and Lab step titles for Connect to Kiorex use the same spelling. Confirm, or ask for the Latin name.
2. Plurals: Clinic onboarding.autoDetect uses the six Arabic plural forms (خطوة واحدة / خطوتان / ٣-١٠ خطوات / ١١+ خطوة). The progress counters avoid the noun ("تم إنجاز ٢ من ١٢") so they need no plural. Please check both read naturally.
3. Percent: "٪" is used in the progress counters; check the placement next to the number in RTL.
4. "Skip" is تخطي (optional step) and "Skip for now" is تخطَّ الآن; "Open" is افتح; "Start" is ابدأ. Check these button verbs.
5. Arabic Nurse product name is still an open founder question (Q12); the Nurse strings avoid the product name.

## Clinic and Nurse checklist (`onboarding.*` in ar.json)

| Key | English | Arabic | Review |
|---|---|---|---|
| `title` | Welcome — quick setup | مرحبًا — الإعداد السريع | |
| `subtitle` | Finish these steps to go live with patients. Each one opens the exact screen and ticks itself when done. | أكمل هذه الخطوات لتبدأ باستقبال المرضى. كل خطوة تفتح الشاشة المناسبة وتكتمل تلقائيًا. | |
| `goToDashboard` | Open dashboard | فتح لوحة التحكم | |
| `viewAll` | Full checklist | كل الخطوات | |
| `dismiss` | Dismiss | إخفاء | |
| `skip` | Skip | تخطي | |
| `optional` | optional | اختياري | |
| `progress` | Setup progress | تقدّم الإعداد | |
| `progressLabel` | {{percent}}% of required steps done | {{percent}}٪ من الخطوات المطلوبة | |
| `checklist.clinic_profile` | Confirm clinic profile and license details | تأكيد ملف العيادة والترخيص | |
| `checklist.clinic_logo` | Upload clinic logo | ارفع شعار العيادة | |
| `checklist.working_hours` | Set working hours | ضبط مواعيد العمل | |
| `checklist.appointment_types` | Configure appointment types and fees | إعداد أنواع المواعيد والرسوم | |
| `checklist.doctor_availability` | Set your availability | تحديد أوقات توفرك | |
| `checklist.invite_receptionist` | Invite a receptionist | ادعُ موظف استقبال | |
| `checklist.whatsapp_reminders` | Turn on WhatsApp reminders | تفعيل تذكيرات واتساب | |
| `checklist.import_patients` | Import or add patients | استيراد أو إضافة مرضى | |
| `checklist.first_appointment` | Book your first appointment | حجز أول موعد | |
| `checklist.first_check_in` | Complete your first check-in | إتمام أول تسجيل وصول | |
| `checklist.kiorex_profile` | Publish Kiorex marketplace profile | نشر ملف العيادة على كيوريكس | |
| `checklist.doctor_verification` | Verify your doctor credentials for Kiorex | تحقق من بيانات الطبيب لعرضها على كيوريكس | |
| `checklist.connect_kiorex` | Connect to Kiorex | الربط مع كيوريكس | |
| `checklist.nurse_verification` | Verify your nursing credentials | وثّق بيانات مهنتك التمريضية | |
| `checklist.nurse_zones` | Set your coverage zones | حدد مناطق التغطية | |
| `checklist.nurse_services` | Choose the services you offer | اختر الخدمات التي تقدمها | |
| `checklist.nurse_prices` | Set your prices | حدد أسعارك | |
| `checklist.nurse_availability` | Set your weekly availability | حدد مواعيدك الأسبوعية | |
| `checklist.nurse_safety_contact` | Add a safety contact | أضف جهة اتصال للسلامة | |
| `subtitleDone` | Everything is set up. | كل شيء جاهز. | |
| `expand` | Show steps | عرض الخطوات | |
| `collapse` | Hide steps | إخفاء الخطوات | |
| `progressCount` | {{done}} of {{total}} done · {{percent}}% | {{done}} من {{total}} · {{percent}}٪ | |
| `aggregate` | {{done}} of {{total}} clinics | {{done}} من {{total}} عيادات | |
| `showClinics` | Show {{count}} clinics | عرض {{count}} عيادات | |
| `hideClinics` | Hide clinics | إخفاء العيادات | |
| `start` | Start | ابدأ | |
| `open` | Open | افتح | |
| `done` | Done | تم | |
| `skipped` | Skipped | تم التخطي | |
| `upgrade` | Upgrade to unlock | رقّ باقتك لتفعيلها | |
| `askOwner` | Ask the owner. | اطلب من المالك. | |
| `whoCan` | Can be done by: {{roles}}. | يمكن تنفيذها بواسطة: {{roles}}. | |
| `autoDetect` | {{count}} steps · detected automatically from your data, no ticking needed. | {{count}} خطوة · تُكتشف تلقائيًا من بياناتك دون تحديد يدوي. | |
| `completeTitle` | You're all set | كل شيء جاهز | |
| `completeBody` | Your organisation is fully set up. You can revisit any screen from the menu at any time. | تم إعداد مؤسستك بالكامل. يمكنك العودة إلى أي شاشة من القائمة في أي وقت. | |
| `confirmHours` | Confirm these hours | تأكيد هذه المواعيد | |
| `bar.region` | Quick setup | الإعداد السريع | |
| `bar.stepOf` | Step {{n}} of {{total}} | الخطوة {{n}} من {{total}} | |
| `bar.back` | Back to checklist | العودة إلى القائمة | |
| `bar.skipForNow` | Skip for now | تخطَّ الآن | |
| `bar.doneReturning` | Done. Taking you back to the checklist... | تم. نعيدك إلى قائمة الإعداد... | |
| `bar.alreadyDone` | This step is already done. | هذه الخطوة مكتملة بالفعل. | |
| `availability.title` | Set your availability | حدد مواعيد عملك | |
| `availability.at` | Your weekly working hours at {{clinic}} | مواعيدك الأسبوعية في {{clinic}} | |
| `availability.hint` | Your weekly working hours | مواعيدك الأسبوعية | |
| `availability.card` | Weekly availability | المواعيد الأسبوعية | |
| `roles.group_admin` | Owner / group admin | المالك / مدير المجموعة | |
| `roles.clinic_admin` | Clinic admin | مدير العيادة | |
| `roles.branch_manager` | Branch manager | مدير الفرع | |
| `roles.physician` | Doctor | الطبيب | |
| `roles.nurse` | Nurse | الممرض | |
| `roles.receptionist` | Receptionist | موظف الاستقبال | |
| `roles.call_center` | Call center | مركز الاتصال | |
| `roles.finance_officer` | Finance | المالية | |
| `roles.hr_officer` | HR | الموارد البشرية | |
| `why.clinic_profile` | Replace the placeholder licence number with the real one. | استبدل رقم الترخيص المؤقت برقم الترخيص الفعلي. | |
| `why.clinic_logo` | Shown on invoices and prescriptions. | يظهر على الفواتير والوصفات. | |
| `why.working_hours` | Opening and closing times guide booking. Save them, even if the defaults are right. | مواعيد الفتح والإغلاق ترشد الحجز. احفظها حتى لو كانت الافتراضية مناسبة. | |
| `why.appointment_types` | Review the visit types and set their fees and durations. | راجع أنواع الزيارات وحدد رسومها ومددها. | |
| `why.doctor_availability` | Pick the days and hours you see patients. | اختر أيام وساعات استقبال المرضى. | |
| `why.invite_receptionist` | Send an invitation link to your front-desk colleague. | أرسل رابط دعوة لزميلك في الاستقبال. | |
| `why.whatsapp_reminders` | Cut no-shows with automatic reminders. | قلّل الغياب بتذكيرات تلقائية. | |
| `why.import_patients` | Bring your patient list from a spreadsheet, or add patients by hand. | استورد قائمة المرضى من ملف، أو أضفهم يدويًا. | |
| `why.first_appointment` | Book a real appointment for a patient. | احجز موعدًا حقيقيًا لمريض. | |
| `why.first_check_in` | Check the patient in at the front desk. | سجّل وصول المريض في الاستقبال. | |
| `why.kiorex_profile` | Make this clinic bookable on Kiorex (needs a verified doctor and a bookable visit type). | اجعل هذه العيادة قابلة للحجز على كيوريكس (تحتاج طبيبًا موثّقًا ونوع زيارة قابلًا للحجز). | |
| `why.doctor_verification` | Upload credentials so patients can trust your listing. | ارفع المستندات ليثق المرضى بملفك. | |
| `why.connect_kiorex` | Optional. Let patients find and book you on Kiorex. | اختياري. دع المرضى يجدونك ويحجزون عندك عبر كيوريكس. | |
| `why.nurse_verification` | Upload ID and credentials for review. | ارفع الهوية والمستندات للمراجعة. | |
| `why.nurse_zones` | The districts you travel to. | الأحياء التي تصل إليها. | |
| `why.nurse_services` | Add the home-visit services you offer. | أضف خدمات الزيارات المنزلية التي تقدمها. | |
| `why.nurse_prices` | Every service needs a price above zero. | يجب أن يكون لكل خدمة سعر أكبر من صفر. | |
| `why.nurse_availability` | The days and hours you take visits. | الأيام والساعات التي تستقبل فيها الزيارات. | |
| `why.nurse_safety_contact` | A phone number we alert if a visit raises a safety concern. | رقم هاتف نُنبّهه إذا ظهر قلق على السلامة أثناء زيارة. | |

## Nurse practice page (`nurse.onboarding.*`)

| Key | English | Arabic | Review |
|---|---|---|---|
| `title` | Set up your practice | إعداد ممارستك | |
| `kind.SOLO` | Solo nurse | ممرض/ة مستقل/ة | |
| `kind.AGENCY` | Nursing agency | شركة تمريض | |
| `progress` | {{done}} of {{total}} steps done | تم إنجاز {{done}} من {{total}} | |
| `complete` | All set. You are ready for visits. | كل شيء جاهز. أنت مستعد للزيارات. | |
| `done` | Done | تم | |
| `todo` | To do | مطلوب | |
| `evidence` | Evidence needed | الأدلة المطلوبة | |
| `evidenceItems.id_selfie_match` | ID and selfie match | مطابقة الهوية والصورة الشخصية | |
| `evidenceItems.criminal_record_certificate` | Criminal-record certificate | شهادة الحالة الجنائية | |
| `openVerification` | Open verification | فتح التحقق | |
| `openServices` | Set services and prices | ضبط الخدمات والأسعار | |
| `openSafety` | Set safety contact | ضبط جهة اتصال السلامة | |
| `steps.profession_verification.title` | Verify your nursing licence | تحقق من رخصة التمريض | |
| `steps.profession_verification.help` | Needed before you can be sent to patients or listed on Kiorex. | مطلوب قبل إرسالك للمرضى أو ظهورك على كيوريكس. | |
| `steps.coverage_zones.title` | Choose your coverage zones | اختر مناطق التغطية | |
| `steps.coverage_zones.help` | The districts you will travel to. | الأحياء التي ستسافر إليها. | |
| `steps.services_offered.title` | Pick the services you offer | اختر الخدمات التي تقدمها | |
| `steps.services_offered.help` | Injections, dressings, infusions and more. | الحقن والجروح والمحاليل وغيرها. | |
| `steps.prices.title` | Set your prices | حدّد أسعارك | |
| `steps.prices.help` | Every service needs a price above zero. | كل خدمة تحتاج سعرًا أكبر من صفر. | |
| `steps.availability.title` | Set your weekly availability | حدّد أوقات عملك الأسبوعية | |
| `steps.availability.help` | Patients can only book inside these hours. | يحجز المرضى داخل هذه الساعات فقط. | |
| `steps.safety_contact.title` | Add a safety contact | أضف جهة اتصال للسلامة | |
| `steps.safety_contact.help` | Someone who is alerted if you do not check in or press SOS. | شخص يتلقى تنبيهًا إن لم تؤكد سلامتك أو ضغطت الاستغاثة. | |
| `kiorexTitle` | Kiorex listing | الظهور على كيوريكس | |
| `kiorexSolo` | Solo nurses are listed on Kiorex only after launch approval and checked ID evidence. The software works fully without a listing. | يظهر الممرضون المستقلون على كيوريكس بعد اعتماد الإطلاق والتحقق من الهوية فقط. البرنامج يعمل بالكامل بدون ظهور. | |
| `kiorexAgency` | Agencies are listed on Kiorex; the agency assigns the nurse for each booking. | تظهر الشركات على كيوريكس، وتعيّن الشركة الممرض لكل حجز. | |
| `listingPaused` | Individual listing is paused for now. Your practice keeps working. | الظهور الفردي متوقف حاليًا. تستمر ممارستك في العمل. | |

## Nurse home card (`nurseSetupCard.*`, new)

| Key | English | Arabic | Review |
|---|---|---|---|
| `title` | Finish setting up your practice | أكمل إعداد ممارستك | |
| `next` | Next: {{step}} | الخطوة التالية: {{step}} | |
| `count` | {{done}} of {{total}} steps done | تم إنجاز {{done}} من {{total}} | |
| `cta` | Continue setup | متابعة الإعداد | |
| `open` | Open setup checklist | فتح قائمة الإعداد | |

## Pharmacy checklist (`setup.*`)

| Key | English | Arabic | Review |
|---|---|---|---|
| `title` | Welcome — quick setup | مرحبًا — الإعداد السريع | |
| `subtitle` | Finish these steps to start working. Each one opens the exact screen and ticks itself when done. | أكمل هذه الخطوات لتبدأ العمل. كل خطوة تفتح الشاشة المناسبة وتكتمل تلقائيًا. | |
| `subtitleDone` | Everything is set up. | كل شيء جاهز. | |
| `expand` | Show steps | عرض الخطوات | |
| `collapse` | Hide steps | إخفاء الخطوات | |
| `progress` | Setup progress | تقدم الإعداد | |
| `progressCount` | {{done}} of {{total}} done · {{percent}}% | {{done}} من {{total}} · {{percent}}٪ | |
| `aggregate` | {{done}} of {{total}} | {{done}} من {{total}} | |
| `showEntities` | Show {{count}} | عرض {{count}} | |
| `hideEntities` | Hide list | إخفاء القائمة | |
| `start` | Start | ابدأ | |
| `open` | Open | افتح | |
| `done` | Done | تم | |
| `skipped` | Skipped | تم التخطي | |
| `skip` | Skip | تخطَّ | |
| `optional` | optional | اختياري | |
| `askOwner` | Ask the owner. | اطلب من المالك. | |
| `whoCan` | Can be done by: {{roles}}. | يمكن تنفيذها بواسطة: {{roles}}. | |
| `autoDetect` | Detected automatically from your data, no ticking needed. | تُكتشف تلقائيًا من بياناتك دون تحديد يدوي. | |
| `completeTitle` | You're all set | كل شيء جاهز | |
| `completeBody` | Your organisation is fully set up. You can revisit any screen from the menu at any time. | تم إعداد مؤسستك بالكامل. يمكنك العودة إلى أي شاشة من القائمة في أي وقت. | |
| `dismiss` | Dismiss | إخفاء | |
| `bar.region` | Quick setup | الإعداد السريع | |
| `bar.stepOf` | Step {{n}} of {{total}} | الخطوة {{n}} من {{total}} | |
| `bar.back` | Back to checklist | العودة إلى القائمة | |
| `bar.skipForNow` | Skip for now | تخطَّ الآن | |
| `bar.doneReturning` | Done. Taking you back to the checklist... | تم. نعيدك إلى قائمة الإعداد... | |
| `bar.alreadyDone` | This step is already done. | هذه الخطوة مكتملة بالفعل. | |
| `steps.branch_licence` | Add the pharmacy licence and address | أضف ترخيص الصيدلية وعنوانها | |
| `steps.pharmacist_licence` | Add a pharmacist with a syndicate licence | أضف صيدليًا برقم ترخيص النقابة | |
| `steps.drug_prices` | Set your selling prices | حدد أسعار البيع | |
| `steps.first_stock` | Receive your first stock | استلم أول مخزون | |
| `steps.invite_staff` | Add a team member | أضف عضوًا في الفريق | |
| `steps.receipt_settings` | Set up your receipt | جهّز الإيصال | |
| `steps.first_sale` | Make your first sale | نفّذ أول عملية بيع | |
| `steps.connect_kiorex` | Connect to Kiorex | الربط مع كيوريكس | |
| `why.branch_licence` | The licence number and address print on receipts and labels. | رقم الترخيص والعنوان يُطبعان على الإيصالات والملصقات. | |
| `why.pharmacist_licence` | Prescriptions can only be signed off by a licensed pharmacist. | لا يمكن اعتماد الوصفات إلا بواسطة صيدلي مرخّص. | |
| `why.drug_prices` | Price the drugs you sell in the catalogue price book. | سعّر الأدوية التي تبيعها في دفتر الأسعار. | |
| `why.first_stock` | Receive stock into the branch so it can be sold. | استلم مخزونًا في الفرع ليصبح قابلًا للبيع. | |
| `why.invite_staff` | Add a cashier, assistant or another pharmacist. | أضف كاشيرًا أو مساعدًا أو صيدليًا آخر. | |
| `why.receipt_settings` | Header and footer text for printed receipts. | نص رأس الإيصال وذيله عند الطباعة. | |
| `why.first_sale` | Ring up a sale at the counter. | نفّذ عملية بيع على الكاونتر. | |
| `why.connect_kiorex` | Optional. Let patients find and order from you on Kiorex. | اختياري. دع المرضى يجدونك ويطلبون منك عبر كيوريكس. | |
| `roles.OWNER` | Owner | المالك | |
| `roles.PHARMACIST` | Pharmacist | الصيدلي | |
| `roles.CASHIER` | Cashier | أمين الصندوق | |
| `roles.BRANCH_MANAGER` | Branch manager | مدير الفرع | |
| `roles.CHAIN_OPS` | Chain operations | عمليات السلسلة | |
| `roles.ASSISTANT` | Assistant | المساعد | |

## Lab checklist (`setup.*`)

| Key | English | Arabic | Review |
|---|---|---|---|
| `title` | Welcome — quick setup | مرحبًا — الإعداد السريع | |
| `subtitle` | Finish these steps to start working. Each one opens the exact screen and ticks itself when done. | أكمل هذه الخطوات لتبدأ العمل. كل خطوة تفتح الشاشة المناسبة وتكتمل تلقائيًا. | |
| `subtitleDone` | Everything is set up. | كل شيء جاهز. | |
| `expand` | Show steps | عرض الخطوات | |
| `collapse` | Hide steps | إخفاء الخطوات | |
| `progress` | Setup progress | تقدم الإعداد | |
| `progressCount` | {{done}} of {{total}} done · {{percent}}% | {{done}} من {{total}} · {{percent}}٪ | |
| `aggregate` | {{done}} of {{total}} | {{done}} من {{total}} | |
| `showEntities` | Show {{count}} | عرض {{count}} | |
| `hideEntities` | Hide list | إخفاء القائمة | |
| `start` | Start | ابدأ | |
| `open` | Open | افتح | |
| `done` | Done | تم | |
| `skipped` | Skipped | تم التخطي | |
| `skip` | Skip | تخطَّ | |
| `optional` | optional | اختياري | |
| `askOwner` | Ask the owner. | اطلب من المالك. | |
| `whoCan` | Can be done by: {{roles}}. | يمكن تنفيذها بواسطة: {{roles}}. | |
| `autoDetect` | Detected automatically from your data, no ticking needed. | تُكتشف تلقائيًا من بياناتك دون تحديد يدوي. | |
| `completeTitle` | You're all set | كل شيء جاهز | |
| `completeBody` | Your organisation is fully set up. You can revisit any screen from the menu at any time. | تم إعداد مؤسستك بالكامل. يمكنك العودة إلى أي شاشة من القائمة في أي وقت. | |
| `dismiss` | Dismiss | إخفاء | |
| `bar.region` | Quick setup | الإعداد السريع | |
| `bar.stepOf` | Step {{n}} of {{total}} | الخطوة {{n}} من {{total}} | |
| `bar.back` | Back to checklist | العودة إلى القائمة | |
| `bar.skipForNow` | Skip for now | تخطَّ الآن | |
| `bar.doneReturning` | Done. Taking you back to the checklist... | تم. نعيدك إلى قائمة الإعداد... | |
| `bar.alreadyDone` | This step is already done. | هذه الخطوة مكتملة بالفعل. | |
| `steps.lab_licence` | Add the lab licence and address | أضف ترخيص المعمل وعنوانه | |
| `steps.starter_catalogue` | Load your test catalogue | حمّل كتالوج التحاليل | |
| `steps.signatory` | Add an authorised signatory with a licence | أضف موقّعًا معتمدًا برقم ترخيص | |
| `steps.invite_staff` | Add a team member | أضف عضوًا في الفريق | |
| `steps.lab_coverage` | Set home-collection districts | حدد أحياء السحب المنزلي | |
| `steps.safety_contact` | Add a safety contact | أضف جهة اتصال للسلامة | |
| `steps.first_order` | Create your first order | أنشئ أول طلب | |
| `steps.first_report` | Release your first report | أصدر أول تقرير | |
| `steps.connect_kiorex` | Connect to Kiorex | الربط مع كيوريكس | |
| `why.lab_licence` | The licence number and address print on reports. | رقم الترخيص والعنوان يُطبعان على التقارير. | |
| `why.starter_catalogue` | Load the starter tests, or import your own catalogue. | حمّل التحاليل الأساسية أو استورد كتالوجك. | |
| `why.signatory` | Reports can only be signed by a licensed signatory. | لا يمكن توقيع التقارير إلا بواسطة موقّع مرخّص. | |
| `why.invite_staff` | Add a technologist, receptionist or phlebotomist. | أضف فنيًا أو موظف استقبال أو أخصائي سحب. | |
| `why.lab_coverage` | The districts this lab collects samples in. | الأحياء التي يسحب منها هذا المعمل. | |
| `why.safety_contact` | A phone number alerted if a collector raises a safety concern. | رقم هاتف نُنبّهه عند وجود قلق على سلامة القائم بالسحب. | |
| `why.first_order` | Register a patient and create a lab order. | سجّل مريضًا وأنشئ طلب تحاليل. | |
| `why.first_report` | Run a result through validation and release the report. | أدخل نتيجة واعتمدها ثم أصدر التقرير. | |
| `why.connect_kiorex` | Optional. Let patients find and book you on Kiorex. | اختياري. دع المرضى يجدونك ويحجزون عندك عبر كيوريكس. | |
| `roles.OWNER` | Owner | المالك | |
| `roles.LAB_DIRECTOR` | Lab director | مدير المعمل | |
| `roles.AUTHORIZED_SIGNATORY` | Authorised signatory | الموقّع المعتمد | |
| `roles.TECHNOLOGIST` | Technologist | الفني | |
| `roles.PHLEBOTOMIST` | Phlebotomist | أخصائي السحب | |
| `roles.RECEPTION` | Reception | الاستقبال | |
| `roles.BRANCH_MANAGER` | Branch manager | مدير الفرع | |
| `roles.SUPERVISOR` | Supervisor | المشرف | |
| `roles.FINANCE` | Finance | المالية | |

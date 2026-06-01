# Abak User Role Matrix

> **Superseded (2026-06-01).** The `appRole` column reflects the old fixed 8-role enum. The role model is now permission-based — see `../architecture/abak-rbac-design.md` and test with `abak-rbac-test-plan.md`. Kept only as the original source→account reference.

Source workbook: `أباك_قائمة_مستخدمي_النظام_2026_v4.xlsx`

Total accounts: **25**

## Mapping rule

- Real employee names/emails are kept in the client repo only, not BuilderOS.
- `appRole` is constrained by current Prisma `UserRole` enum.
- Department engineer/manager mapping is intentionally coarse until finer RBAC exists.

## الإدارة التنفيذية

| Name                    | Email                       | Technical role | Job title                       | Product persona                        | appRole     | Test focus                                  | Gap |
| ----------------------- | --------------------------- | -------------- | ------------------------------- | -------------------------------------- | ----------- | ------------------------------------------- | --- |
| النظام / معلومات الشركة | info@abak.com.sa            | System         | نظام / حساب عام                 | System / Company account               | VIEWER      | System identity; avoid using as human actor | OK  |
| عبدالله محسن            | abdullah.mohsen@abak.com.sa | Super Admin    | مدير قسم ال IT وتطوير الاعمال   | CEO / Super Admin                      | SUPER_ADMIN | Admin, all modules, approvals, settings     | OK  |
| مسفر القحطاني           | mesfer@abak.com.sa          | Administrator  | رئيس مجلس الإدارة               | Sales/Business Manager or Main Manager | ADMIN       | Department triage, reports, admin workflows | OK  |
| محمد العياف             | m.alayaf@abak.com.sa        | Administrator  | الرئيس التنفيذي                 | Sales/Business Manager or Main Manager | ADMIN       | Department triage, reports, admin workflows | OK  |
| صالح الشهري             | salshehri@abak.com.sa       | User           | المدير التنفيذي — تطوير الأعمال | Executive Viewer                       | VIEWER      | Dashboard/report visibility                 | OK  |

## القسم المعماري

| Name             | Email                            | Technical role | Job title | Product persona              | appRole           | Test focus                                       | Gap                                                         |
| ---------------- | -------------------------------- | -------------- | --------- | ---------------------------- | ----------------- | ------------------------------------------------ | ----------------------------------------------------------- |
| عبد الغني الموفق | abdulghani.almuwafiq@abak.com.sa | User           | مستخدم    | Department Engineer / Pricer | TECHNICAL_MANAGER | RFQ pricing, project tasks, licence dependencies | Coarse role: app lacks separate DEPARTMENT_ENGINEER/MANAGER |
| أحمد البيطار     | a.albittar@abak.com.sa           | User           | مستخدم    | Department Engineer / Pricer | TECHNICAL_MANAGER | RFQ pricing, project tasks, licence dependencies | Coarse role: app lacks separate DEPARTMENT_ENGINEER/MANAGER |
| هاشم علي         | hashim.ali@abak.com.sa           | User           | مستخدم    | Department Engineer / Pricer | TECHNICAL_MANAGER | RFQ pricing, project tasks, licence dependencies | Coarse role: app lacks separate DEPARTMENT_ENGINEER/MANAGER |
| خالد الخبيري     | khaled@abak.com.sa               | User           | مستخدم    | Department Engineer / Pricer | TECHNICAL_MANAGER | RFQ pricing, project tasks, licence dependencies | Coarse role: app lacks separate DEPARTMENT_ENGINEER/MANAGER |
| أسامة الصامت     | osamah.alsamet@abak.com.sa       | User           | مستخدم    | Department Engineer / Pricer | TECHNICAL_MANAGER | RFQ pricing, project tasks, licence dependencies | Coarse role: app lacks separate DEPARTMENT_ENGINEER/MANAGER |

## الإدارة المالية

| Name                  | Email                  | Technical role | Job title | Product persona | appRole         | Test focus                             | Gap |
| --------------------- | ---------------------- | -------------- | --------- | --------------- | --------------- | -------------------------------------- | --- |
| أحمد العبيري — محاسبة | accounting@abak.com.sa | Accountant     | مسؤول قسم | Finance Officer | FINANCE_MANAGER | Payments, invoices, finance validation | OK  |

## إدارة الخدمات البيئية

| Name         | Email             | Technical role | Job title | Product persona    | appRole | Test focus                                  | Gap |
| ------------ | ----------------- | -------------- | --------- | ------------------ | ------- | ------------------------------------------- | --- |
| أكرم عبدالله | akram@abak.com.sa | Administrator  | مدير قسم  | Department Manager | ADMIN   | Department triage, reports, admin workflows | OK  |

## قسم المساحة

| Name          | Email                          | Technical role | Job title | Product persona              | appRole           | Test focus                                       | Gap                                                         |
| ------------- | ------------------------------ | -------------- | --------- | ---------------------------- | ----------------- | ------------------------------------------------ | ----------------------------------------------------------- |
| علاء احمد     | alaa.ahmed@abak.com.sa         | User           | مستخدم    | Department Engineer / Pricer | TECHNICAL_MANAGER | RFQ pricing, project tasks, licence dependencies | Coarse role: app lacks separate DEPARTMENT_ENGINEER/MANAGER |
| محمد ضيف الله | mohammed.deifallah@abak.com.sa | User           | مستخدم    | Department Engineer / Pricer | TECHNICAL_MANAGER | RFQ pricing, project tasks, licence dependencies | Coarse role: app lacks separate DEPARTMENT_ENGINEER/MANAGER |

## قسم الإشراف والهندسة المدنية

| Name         | Email             | Technical role | Job title | Product persona              | appRole           | Test focus                                       | Gap                                                         |
| ------------ | ----------------- | -------------- | --------- | ---------------------------- | ----------------- | ------------------------------------------------ | ----------------------------------------------------------- |
| أمين النهاري | ameen@abak.com.sa | User           | مسؤول قسم | Department Engineer / Pricer | TECHNICAL_MANAGER | RFQ pricing, project tasks, licence dependencies | Coarse role: app lacks separate DEPARTMENT_ENGINEER/MANAGER |

## إدارة الموارد البشرية

| Name       | Email          | Technical role | Job title | Product persona | appRole | Test focus                   | Gap                                 |
| ---------- | -------------- | -------------- | --------- | --------------- | ------- | ---------------------------- | ----------------------------------- |
| ضحى العوام | hr@abak.com.sa | HR Manager     | مدير قسم  | HR/Admin Viewer | VIEWER  | Non-MVP/support access check | No HR role in current UserRole enum |

## قسم التسويق والمبيعات

| Name                        | Email                         | Technical role   | Job title | Product persona                 | appRole              | Test focus                                  | Gap |
| --------------------------- | ----------------------------- | ---------------- | --------- | ------------------------------- | -------------------- | ------------------------------------------- | --- |
| غادة العتيبي                | ghadah@abak.com.sa            | User             | مستخدم    | Sales Person                    | SALES_REPRESENTATIVE | Lead/RFQ request/client communication       | OK  |
| هيثم محمدي                  | haitham@abak.com.sa           | Administrator    | مدير قسم  | Department Manager              | ADMIN                | Department triage, reports, admin workflows | OK  |
| محمد العطيات — علاقات عملاء | client.relations2@abak.com.sa | User             | مستخدم    | Sales Person                    | SALES_REPRESENTATIVE | Lead/RFQ request/client communication       | OK  |
| مصطفى حلمي                  | mostafa@abak.com.sa           | User             | مستخدم    | Sales Person                    | SALES_REPRESENTATIVE | Lead/RFQ request/client communication       | OK  |
| رحمة طارق — علاقات عملاء    | client.relations1@abak.com.sa | Client Relations | مستخدم    | Sales Person / Client Relations | SALES_REPRESENTATIVE | Lead capture, follow-ups, quote dispatch    | OK  |
| سلوى سعد                    | salwa@abak.com.sa             | User             | مستخدم    | Sales Person                    | SALES_REPRESENTATIVE | Lead/RFQ request/client communication       | OK  |

## إدارة جميع الاقسام الفنية

| Name     | Email              | Technical role | Job title                                   | Product persona    | appRole | Test focus                                  | Gap |
| -------- | ------------------ | -------------- | ------------------------------------------- | ------------------ | ------- | ------------------------------------------- | --- |
| حسن صلاح | hassan@abak.com.sa | Administrator  | مدير قسم المعماري ومدير مكتب إدارة المشاريع | Department Manager | ADMIN   | Department triage, reports, admin workflows | OK  |

## قسم السلامة والأمن الصناعي

| Name         | Email              | Technical role | Job title | Product persona              | appRole           | Test focus                                       | Gap                                                         |
| ------------ | ------------------ | -------------- | --------- | ---------------------------- | ----------------- | ------------------------------------------------ | ----------------------------------------------------------- |
| عمر ربابعة   | omar@abak.com.sa   | User           | مدير قسم  | Department Engineer / Pricer | TECHNICAL_MANAGER | RFQ pricing, project tasks, licence dependencies | Coarse role: app lacks separate DEPARTMENT_ENGINEER/MANAGER |
| وليد بن عابد | w.abid@abak.com.sa | User           | مستخدم    | Department Engineer / Pricer | TECHNICAL_MANAGER | RFQ pricing, project tasks, licence dependencies | Coarse role: app lacks separate DEPARTMENT_ENGINEER/MANAGER |

## Test coverage by persona

- Sales Person: lead capture, communication log, RFQ request, quote dispatch.
- Department Manager / Engineer: RFQ assignment, pricing sections, Lead Pricer, project execution.
- Finance Officer: payment/invoice/finance validation.
- Admin/Super Admin: pricing policy, users, settings, overrides.
- Viewer/System/HR: access boundaries and non-MVP visibility checks.

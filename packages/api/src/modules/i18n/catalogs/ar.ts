export const ar = {
  errors: {
    generic: 'حدث خطأ غير متوقع.',
    unauthorized: 'غير مصرح.',
    forbidden: 'الصلاحية غير كافية.',
    notFound: 'لم يتم العثور على المورد.',
    validation: 'البيانات المدخلة غير صالحة.',
    lead: {
      notFound: 'لم يتم العثور على العميل المحتمل.',
      duplicate: 'يوجد عميل محتمل بنفس رقم الهاتف أو البريد.',
    },
    client: {
      notFound: 'لم يتم العثور على العميل.',
    },
    quote: {
      notFound: 'لم يتم العثور على عرض السعر.',
      cannotEdit: 'لا يمكن تعديل عرض السعر في حالته الحالية.',
    },
    auth: {
      invalidCredentials: 'بيانات الاعتماد غير صحيحة.',
      accountLocked: 'الحساب مقفل. حاول لاحقاً.',
    },
  },
  enums: {
    leadStatus: {
      NEW: 'جديد',
      ASSIGNED: 'تم الإسناد',
      CONTACTED: 'تم التواصل',
      QUALIFIED: 'مؤهل',
      UNQUALIFIED: 'غير مؤهل',
      CONVERTED: 'تم التحويل',
      LOST: 'خاسر',
      DUPLICATE: 'مكرر',
    },
  },
} as const;

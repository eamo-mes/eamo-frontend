import * as XLSX from 'xlsx';

export function generateParameterTemplateBlob(locale: string): Blob {
  const isVi = locale === 'zh-CN';

  const headers = isVi
    ? {
        equipment_code: 'mã thiết bị',
        parameter_code: 'mã thông số',
        value: 'giá trị',
        unit_code: 'đơn vị',
        recorded_at: 'thời gian ghi',
      }
    : {
        equipment_code: 'equipment_code',
        parameter_code: 'parameter_code',
        value: 'value',
        unit_code: 'unit_code',
        recorded_at: 'recorded_at',
      };

  const sampleRows = [
    {
      [headers.equipment_code]: 'EQ-001',
      [headers.parameter_code]: 'PARAM-TEMP',
      [headers.value]: 65.5,
      [headers.unit_code]: isVi ? 'Độ C' : '°C',
      [headers.recorded_at]: '2026-08-05 08:30:00',
    },
    {
      [headers.equipment_code]: 'EQ-002',
      [headers.parameter_code]: 'PARAM-PRESS',
      [headers.value]: 12.0,
      [headers.unit_code]: 'Bar',
      [headers.recorded_at]: '2026-08-05 09:00:00',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'ParameterLogs');

  const wopts: XLSX.WritingOptions = { bookType: 'xlsx', type: 'array' };
  const wbout = XLSX.write(workbook, wopts);
  return new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

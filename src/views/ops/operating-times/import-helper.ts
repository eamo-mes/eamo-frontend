import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import type { OperatingTimeItem, EquipmentOption } from './types';

export const headerMapping = {
  equipment_id: ['equipment_id', 'equipment id', 'equipmentid', 'mã thiết bị', 'code'],
  equipment_name: ['equipment_name', 'equipment name', 'equipmentname', 'tên thiết bị'],
  planned_stop_time: ['planned_stop_time', 'planned stop time', 'plannedstoptime', 'planned_stop', 'planned stop', 'thời gian dừng kế hoạch'],
  unplanned_stop_time: ['unplanned_stop_time', 'unplanned stop time', 'unplannedstoptime', 'unplanned_stop', 'unplanned stop', 'thời gian dừng không kế hoạch'],
  start_time: ['start_time', 'start time', 'starttime', 'start', 'bắt đầu', 'thời gian bắt đầu'],
  end_time: ['end_time', 'end time', 'endtime', 'end', 'kết thúc', 'thời gian kết thúc']
};

export function mapHeader(rawHeader: string): string | null {
  const normalized = rawHeader.trim().toLowerCase();
  for (const [key, synonyms] of Object.entries(headerMapping)) {
    if (synonyms.some(s => s.toLowerCase() === normalized)) {
      return key;
    }
  }
  return null;
}

export function formatParsedDate(val: any): string {
  if (typeof val === 'number') {
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    return dayjs(date).format('YYYY-MM-DD HH:mm:ss');
  }
  if (!val) return '';
  const d = dayjs(String(val).trim());
  if (d.isValid()) {
    return d.format('YYYY-MM-DD HH:mm:ss');
  }
  return String(val);
}

export function parseCSV(text: string): any[][] {
  const lines = text.split(/\r?\n/);
  return lines.map(line => {
    const row: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        row.push(cur);
        cur = '';
      } else {
        cur += char;
      }
    }
    row.push(cur);
    return row.map(cell => cell.trim().replace(/^"|"$/g, ''));
  });
}

export function parseFileContent(
  data: any,
  isExcel: boolean,
  equipments: EquipmentOption[]
): Promise<{ parsedItems: OperatingTimeItem[]; errors: string[] }> {
  return new Promise((resolve, reject) => {
    try {
      let rows: any[] = [];
      if (isExcel) {
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) throw new Error('Workbook contains no sheets');
        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) throw new Error('Worksheet is empty or invalid');
        rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[];
      } else {
        rows = parseCSV(data as string);
      }

      if (rows.length < 2) {
        throw new Error('File must contain a header row and at least one data row.');
      }

      const rawHeaders = rows[0] as string[];
      const mappedHeaders = rawHeaders.map(h => h ? mapHeader(String(h)) : null);

      const missingRequired: string[] = [];
      const requiredKeys = ['equipment_id', 'planned_stop_time', 'start_time', 'end_time'];
      requiredKeys.forEach(reqKey => {
        if (!mappedHeaders.includes(reqKey)) {
          let dispName = reqKey;
          if (reqKey === 'equipment_id') dispName = 'equipment_id / mã thiết bị';
          if (reqKey === 'planned_stop_time') dispName = 'planned_stop_time / thời gian dừng kế hoạch';
          if (reqKey === 'start_time') dispName = 'start_time / bắt đầu';
          if (reqKey === 'end_time') dispName = 'end_time / kết thúc';
          missingRequired.push(dispName);
        }
      });

      if (missingRequired.length > 0) {
        throw new Error(`Missing required columns: ${missingRequired.join(', ')}`);
      }

      const parsedItems: OperatingTimeItem[] = [];
      const errors: string[] = [];

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0 || row.every((cell: any) => cell === null || cell === undefined || cell === '')) {
          continue;
        }

        const item: any = {
          id: `preview-${i}`,
          equipment_id: '',
          equipment_name: '',
          planned_stop_time: 0,
          unplanned_stop_time: 0,
          start_time: '',
          end_time: '',
        };

        mappedHeaders.forEach((key, colIndex) => {
          if (key) {
            item[key] = row[colIndex];
          }
        });

        const rawEquipVal = String(item.equipment_id || '').trim();
        if (!rawEquipVal) {
          errors.push(`Row ${i + 1}: Equipment Code/ID is required.`);
          continue;
        }

        // Find match in equipments list by Code, Name, or ID (UUID)
        const match = equipments.find(e =>
          e.code.toLowerCase() === rawEquipVal.toLowerCase() ||
          e.name.toLowerCase() === rawEquipVal.toLowerCase() ||
          e.id.toLowerCase() === rawEquipVal.toLowerCase()
        );

        if (!match) {
          errors.push(`Row ${i + 1}: Equipment "${rawEquipVal}" does not exist.`);
          continue;
        }

        // Map equipment code/name to database UUID!
        item.equipment_id = match.id;
        item.equipment_name = match.name;
        item.planned_stop_time = Number(item.planned_stop_time) || 0;
        item.unplanned_stop_time = Number(item.unplanned_stop_time) || 0;

        if (item.start_time) {
          item.start_time = formatParsedDate(item.start_time);
        }
        if (item.end_time) {
          item.end_time = formatParsedDate(item.end_time);
        }

        let workingHours = 0;
        if (item.start_time && item.end_time) {
          const start = dayjs(item.start_time);
          const end = dayjs(item.end_time);
          if (start.isValid() && end.isValid()) {
            const diffMin = end.diff(start, 'minute');
            workingHours = Math.max(0, Number((diffMin / 60.0).toFixed(2)));
          }
        }

        item.working_time = workingHours;
        item.planned_operating_time = Math.max(0, workingHours - item.planned_stop_time);
        item.actual_operating_time = Math.max(0, item.planned_operating_time - item.unplanned_stop_time);
        item.availability_factor = item.planned_operating_time > 0
          ? Number(((item.actual_operating_time / item.planned_operating_time) * 100).toFixed(2))
          : 0;

        parsedItems.push(item);
      }

      resolve({ parsedItems, errors });
    } catch (err: any) {
      reject(err);
    }
  });
}

export function exportToExcelBlob(items: OperatingTimeItem[]): Blob {
  const data = items.map(item => ({
    equipment_id: item.equipment_id, // mapped database UUID
    equipment_name: item.equipment_name || '',
    planned_stop_time: item.planned_stop_time,
    unplanned_stop_time: item.unplanned_stop_time,
    start_time: item.start_time,
    end_time: item.end_time
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'OperatingTimes');
  
  const wopts: XLSX.WritingOptions = { bookType: 'xlsx', type: 'array' };
  const wbout = XLSX.write(workbook, wopts);
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

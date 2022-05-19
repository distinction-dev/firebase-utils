import dayjs from 'dayjs';
import { DocumentData, Timestamp } from 'firebase/firestore';

export function forFirebase(
  json: Record<string, any>,
  skipTimeOffset = true
): Record<string, any> {
  const returnData: Record<string, any> = {};
  Object.keys(json).forEach(key => {
    let value = json[key];
    // Added step for converting undefined to null before saving
    if (value === undefined) {
      value = null;
    }
    if (value !== null) {
      if (value instanceof Date) {
        value = Timestamp.fromDate(value);
        if (!skipTimeOffset) {
          value = Timestamp.fromDate(
            dayjs(value).subtract(new Date().getTimezoneOffset(), 'm').toDate()
          );
        }
      } else if (typeof value.toJSON === 'function') {
        value = value.toJSON();
      } else if (Array.isArray(value)) {
        value = value.map(v => {
          if (typeof v === 'object') {
            return forFirebase(v);
          }
          return v;
        });
      } else if (typeof value === 'object') {
        value = forFirebase(value);
      }
    }
    returnData[key] = value;
  });
  return returnData;
}

interface BaseObject {
  id?: string;
  uid?: string;
}

export function fromFirebase<T extends BaseObject>(
  d: DocumentData | any,
  identifier?: keyof T,
  skipTimeOffset = true
): T {
  let data: any;
  let res: T;
  if (typeof d.data === 'function') {
    data = d.data();
    res = data as T;
  } else {
    data = d;
    res = d as T;
  }
  if (data !== null) {
    (Object.keys(data as T) as Array<keyof T>).forEach(key => {
      if (data[key] instanceof Timestamp && !skipTimeOffset) {
        // @ts-ignore
        res[key] = dayjs(data[key].toDate())
          .add(new Date().getTimezoneOffset(), 'm')
          .toDate();
      } else if (Array.isArray(data[key])) {
        res[key] = data[key].map((v: any) => {
          if (typeof v === 'object') {
            return fromFirebase<typeof data[typeof key]>(v);
          }
          return v;
        });
      } else if (typeof data[key] === 'object') {
        // parse objects again
        res[key] = fromFirebase<typeof data[typeof key]>(data[key]);
      }
    });
    if (d.id) {
      if (identifier) {
        res[identifier] = d.id;
      } else {
        res['id'] = d.id;
        res['uid'] = d.id;
      }
    }
  }
  return res;
}

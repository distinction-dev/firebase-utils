import dayjs from 'dayjs';
import { DocumentData, Timestamp } from 'firebase/firestore';

/**
 * Prepare data before saving into firestore, does 3 important things
 * - Converts undefined to null since undefined isn't allowed
 * - Converts Date object to Timestamp
 * - calls toJSON if available on the obj
 * - supports multi level objects
 * @param json Data to save in firebase
 * @param skipTimeOffset Flag to prevent offsetting Date with timezone
 * @returns obj that can be safely saved in firestore
 */
export function forFirestore(
  json: Record<string, any>,
  skipTimeOffset = false
): Record<string, any> {
  const returnData: Record<string, any> = {};
  Object.keys(json).forEach(key => {
    let value = json[key];
    // Added step for converting undefined to null before saving
    if (value === undefined) {
      value = null;
    }
    if (value !== null) {
      if (checkIfDate(value)) {
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
            return forFirestore(v);
          }
          return v;
        });
      } else if (typeof value === 'object') {
        value = forFirestore(value);
      }
    }
    returnData[key] = value;
  });
  return returnData;
}

/**
 * Base Object containing properties that may be returned by fromFirestore
 */
interface BaseObject {
  id?: string;
  uid?: string;
}

/**
 * Parse Firestore Document into a TS interface passed as a generic
 * - Converts Timestamp to Date():- Also applies timezone offset to the time
 * - Can handle multi level objects
 * - Also capable of parsing Arrays
 * @param d Document from Firebase or any other obj that needs to be parsed
 * @param identifier field in interface to attach document id to
 * @param skipTimeOffset Flag used to disable timezone offsetting
 * @returns {T} an object implementing the Generic that was passed
 * @template T
 */
export function fromFirestore<T extends BaseObject>(
  d: DocumentData | any,
  identifier?: keyof T,
  skipTimeOffset = false
): T {
  let data: any;
  let res: T;
  if (d !== null && typeof d.data === 'function') {
    data = d.data();
    res = data as T;
  } else {
    data = d;
    res = d as T;
  }
  if (data !== null) {
    (Object.keys(data as T) as Array<keyof T>).forEach(key => {
      if (checkIfTimestamp(data[key])) {
        // @ts-ignore
        res[key] = convertTimestampToDate(data[key]);
        if (!skipTimeOffset) {
          // @ts-ignore
          res[key] = dayjs(res[key])
            .add(new Date().getTimezoneOffset(), 'm')
            .toDate();
        }
      } else if (Array.isArray(data[key])) {
        res[key] = data[key].map((v: any) => {
          if (typeof v === 'object') {
            return fromFirestore<typeof data[typeof key]>(v);
          }
          return v;
        });
      } else if (typeof data[key] === 'object') {
        // parse objects again
        res[key] = fromFirestore<typeof data[typeof key]>(data[key]);
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

function checkIfTimestamp(obj: any): boolean {
  if (obj instanceof Timestamp) {
    return true;
  } else if (obj !== null && obj !== undefined) {
    const keys = Object.keys(obj);
    if (
      keys.length === 2 &&
      keys.includes('nanoseconds') &&
      keys.includes('seconds')
    ) {
      return true;
    }
  }
  return false;
}

function checkIfDate(obj: any): boolean {
  return Object.prototype.toString.call(obj) === '[object Date]' && !isNaN(obj);
}

function convertTimestampToDate(obj: any): Date {
  if (typeof obj.toDate === 'function') {
    return new Date(obj.toDate());
  } else {
    const keys = Object.keys(obj);
    if (
      keys.length === 2 &&
      keys.includes('nanoseconds') &&
      keys.includes('seconds')
    ) {
      return new Date(obj.seconds * 1000 + obj.nanoseconds / 1000);
    }
  }
  throw new Error('Unacceptable value provided for timestamp');
}

import { z } from 'zod';

export const emailSchema = z.string().email();
export const phoneSchema = z.string().min(10).max(20);
export const urlSchema = z.string().url();
export const uuidSchema = z.string().uuid();

export const validateEmail = (email: string): boolean => {
  return emailSchema.safeParse(email).success;
};

export const validatePhone = (phone: string): boolean => {
  return phoneSchema.safeParse(phone).success;
};

export const validateUrl = (url: string): boolean => {
  return urlSchema.safeParse(url).success;
};

export const validateUuid = (uuid: string): boolean => {
  return uuidSchema.safeParse(uuid).success;
};

export const sanitizeString = (input: string): string => {
  return input.trim().replace(/[<>]/g, '');
};

export const isNonEmptyString = (value: unknown): value is string => {
  return typeof value === 'string' && value.trim().length > 0;
};
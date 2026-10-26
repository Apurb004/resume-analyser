/**
 * @file server/middleware/validate.ts
 * Server-side input validation middleware using Zod.
 * Enforces strict typing and returns standardized 400 VALIDATION_ERROR responses.
 */

import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema, ZodError } from 'zod';
import { AppError } from '../utils/errorHandler.ts';

/**
 * Express middleware generator that validates req.body against a Zod schema.
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const issues = err.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
          code: i.code,
        }));
        const summary = issues.map((i) => (i.path ? `${i.path}: ${i.message}` : i.message)).join('; ');
        next(new AppError(`Validation failed: ${summary}`, 400, 'VALIDATION_ERROR', issues));
      } else {
        next(err);
      }
    }
  };
}

/**
 * Reusable Zod schemas matching shared data contracts
 */

export const ExtractedSkillSchema = z.object({
  name: z.string().min(1, 'Skill name cannot be empty'),
  category: z.enum(['technical', 'soft', 'domain', 'tool', 'language']),
  proficiency: z.enum(['beginner', 'intermediate', 'advanced', 'expert']).optional(),
  yearsOfExperience: z.number().min(0).max(50).optional(),
  evidenceSnippet: z.string().max(1000).optional(),
});

export const EducationItemSchema = z.object({
  id: z.string().min(1),
  institution: z.string().min(1),
  degree: z.string().min(1),
  fieldOfStudy: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  gradeOrGpa: z.string().optional(),
  highlights: z.array(z.string()).optional(),
});

export const ProjectItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  technologies: z.array(z.string()),
  link: z
    .string()
    .refine(
      (val) => !val || val === '' || val.startsWith('https://') || val.startsWith('http://'),
      { message: 'Project link must use http:// or https:// protocol' }
    )
    .optional()
    .or(z.literal('')),
});

export const ExperienceItemSchema = z.object({
  id: z.string().min(1),
  company: z.string().min(1),
  position: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().optional(),
  isCurrentRole: z.boolean().optional(),
  location: z.string().optional(),
  responsibilities: z.array(z.string()),
  skillsUsed: z.array(z.string()).optional(),
});

export const CertificationItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  issuer: z.string().optional(),
  issueDate: z.string().optional(),
  expiryDate: z.string().optional(),
  credentialId: z.string().optional(),
});

export const CandidateProfileSchema = z.object({
  id: z.string().min(1),
  fullName: z.string().min(1, 'Full name is required'),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  location: z.string().optional(),
  summary: z.string().optional(),
  skills: z.array(ExtractedSkillSchema),
  experience: z.array(ExperienceItemSchema),
  education: z.array(EducationItemSchema),
  projects: z.array(ProjectItemSchema),
  certifications: z.array(CertificationItemSchema).optional(),
  achievements: z.array(z.string()).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const JobListingSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  company: z.string().min(1),
  location: z.string().min(1),
  employmentType: z.enum(['full-time', 'part-time', 'contract', 'remote', 'hybrid']),
  experienceLevel: z.enum(['entry', 'mid', 'senior', 'lead', 'executive']),
  description: z.string().min(1),
  requiredSkills: z.array(z.string()),
  preferredSkills: z.array(z.string()).optional(),
  salaryRange: z
    .object({
      min: z.number().min(0),
      max: z.number().min(0),
      currency: z.string(),
    })
    .optional(),
  postedDate: z.string().optional(),
  isSample: z.boolean().optional(),
});

// Endpoint payload schemas
export const SkillExtractionBodySchema = z.object({
  resumeText: z.string().min(10, 'Resume text must contain at least 10 characters'),
});

export const ProfileRatingBodySchema = z.object({
  profile: CandidateProfileSchema,
  targetRole: z.string().optional(),
});

export const JobMatchBodySchema = z.object({
  profile: CandidateProfileSchema,
  jobs: z.array(JobListingSchema).min(1, 'At least one job listing is required when jobs array is provided').optional(),
});

export const ImprovementTipBodySchema = z.object({
  profile: CandidateProfileSchema,
  rating: z.any().optional(),
  jobMatch: z.any().optional(),
  targetJob: JobListingSchema.optional(),
  targetRole: z.string().optional(),
});

import type { Profile } from '@condocloud/shared';

export interface AuthenticatedRequest extends Request {
  user: Profile;
  condominiumId: string;
}

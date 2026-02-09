import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserPayload } from '../../../common/types/user-payload.interface';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = UserPayload>(err: Error | null, user: TUser | false): TUser | undefined {
    // No error is thrown if no user is found
    // Returns user if found, otherwise returns undefined
    return user || undefined;
  }
}

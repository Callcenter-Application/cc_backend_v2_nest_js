import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard.js';
import { roleEnum } from '../../user/enums/roleEnum.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import type { AuthenticatedUser } from '../strategies/jwt.strategy.js';

const contextFor = (user?: AuthenticatedUser) => {
  const handler = () => undefined;
  class TestController {}
  return {
    context: {
      getHandler: () => handler,
      getClass: () => TestController,
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    } as unknown as ExecutionContext,
    handler,
    TestController,
  };
};

const admin: AuthenticatedUser = {
  id: 1,
  email: 'admin@x.com',
  role: roleEnum.ADMINISTRATOR,
};
const operator: AuthenticatedUser = {
  id: 2,
  email: 'op@x.com',
  role: roleEnum.OPERATOR,
};

describe('RolesGuard', () => {
  const reflector = new Reflector();
  const guard = new RolesGuard(reflector);

  it('allows the request when no @Roles metadata is set', () => {
    const { context } = contextFor(undefined);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows the request when @Roles is empty', () => {
    const { context, handler } = contextFor(undefined);
    Reflect.defineMetadata(ROLES_KEY, [], handler);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows a user whose role is required on the handler', () => {
    const { context, handler } = contextFor(admin);
    Reflect.defineMetadata(ROLES_KEY, [roleEnum.ADMINISTRATOR], handler);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('accepts any of several required roles', () => {
    const { context, handler } = contextFor(operator);
    Reflect.defineMetadata(
      ROLES_KEY,
      [roleEnum.SUPERVISOR, roleEnum.OPERATOR],
      handler,
    );
    expect(guard.canActivate(context)).toBe(true);
  });

  it('reads @Roles from the controller class when the handler has none', () => {
    const { context, TestController } = contextFor(operator);
    Reflect.defineMetadata(ROLES_KEY, [roleEnum.ADMINISTRATOR], TestController);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('rejects a user without the required role', () => {
    const { context, handler } = contextFor(operator);
    Reflect.defineMetadata(ROLES_KEY, [roleEnum.ADMINISTRATOR], handler);
    expect(() => guard.canActivate(context)).toThrow(
      new ForbiddenException('Insufficient role permissions'),
    );
  });

  it('rejects when there is no authenticated user', () => {
    const { context, handler } = contextFor(undefined);
    Reflect.defineMetadata(ROLES_KEY, [roleEnum.ADMINISTRATOR], handler);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});

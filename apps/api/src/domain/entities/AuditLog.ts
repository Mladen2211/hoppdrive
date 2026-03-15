import { Entity } from './Entity';

export interface AuditLogProps {
  id: string;
  adminId: string;
  action: string;
  resource: string;
  resourceId: string | null;
  details: string | null;
  createdAt?: Date;
}

/**
 * Immutable audit log entry for compliance (FADP).
 * Records all sensitive admin actions.
 */
export class AuditLog extends Entity {
  public readonly adminId: string;
  public readonly action: string;
  public readonly resource: string;
  public readonly resourceId: string | null;
  public readonly details: string | null;

  private constructor(props: AuditLogProps) {
    super(props.id, props.createdAt);
    this.adminId = props.adminId;
    this.action = props.action;
    this.resource = props.resource;
    this.resourceId = props.resourceId;
    this.details = props.details;
  }

  static create(props: AuditLogProps): AuditLog {
    if (!props.adminId) throw new Error('Admin ID is required for audit log');
    if (!props.action) throw new Error('Action is required for audit log');
    if (!props.resource) throw new Error('Resource is required for audit log');
    return new AuditLog(props);
  }
}

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * A JWT that was invalidated by logout before its natural expiry.
 * Only the SHA-256 hash of the token is stored, never the token itself.
 */
@Entity()
export class RevokedToken {
  @PrimaryGeneratedColumn()
  id: number;

  @Index({ unique: true })
  @Column({ length: 64 })
  tokenHash: string;

  // Once the JWT expires on its own the row is no longer needed and can be purged.
  @Index()
  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  revokedAt: Date;
}

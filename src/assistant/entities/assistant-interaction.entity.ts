import { Column, CreateDateColumn, Entity, PrimaryColumn, } from 'typeorm';

export type InteractionOutcome = 'accepted' | 'modified' | 'abandoned';

@Entity('assistant_interactions')
export class AssistantInteraction {
  @PrimaryColumn()
  sessionId: string;

  @Column({ nullable: true })
  userId?: string;

  @Column({ type: 'jsonb' })
  draftSnapshot: any;

  @Column({ type: 'jsonb' })
  recommendedSlate: any;

  @Column({ type: 'jsonb' })
  advice: any;

  @Column({
    type: 'enum',
    enum: ['accepted', 'modified', 'abandoned'],
    default: 'abandoned',
  })
  outcome: InteractionOutcome = 'abandoned';

  @Column({ nullable: true })
  rating?: number;

  @Column({ nullable: true })
  comment?: string;

  @CreateDateColumn()
  createdAt: Date;
}

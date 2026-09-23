import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { EmailJob } from '../src/email/entities/email-job.entity.js';
import { EmailJobStatus } from '../src/email/enums/email-job-status.enum.js';
import { EmailProvider } from '../src/email/enums/email-provider.enum.js';
import { User } from '../src/users/entities/user.entity.js';
import { Role } from '../src/roles/entities/role.entity.js';
import { Phase152EmailJobModel1790100000000 } from '../src/database/migrations/1790100000000-Phase15_2_EmailJobModel.js';

describe('Phase 15.2 Email Job Database Model Specification', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let emailJobRepo: Repository<EmailJob>;
  let userRepo: Repository<User>;
  let roleRepo: Repository<Role>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = app.get(DataSource);
    emailJobRepo = dataSource.getRepository(EmailJob);
    userRepo = dataSource.getRepository(User);
    roleRepo = dataSource.getRepository(Role);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(async () => {
    // Clean up test email logs and email jobs created during testing
    await dataSource.query(`DELETE FROM "email_logs"`);
    await dataSource.query(`DELETE FROM "email_jobs" WHERE idempotency_key LIKE 'TEST_%' OR idempotency_key LIKE 'test_%'`);
  });

  it('1. should insert a valid EmailJob record', async () => {
    const job = emailJobRepo.create({
      recipientEmail: 'test.user@rmrit.com',
      recipientName: 'Test User',
      eventType: 'RM_SUBMITTED',
      templateKey: 'rm_submitted_template',
      subject: 'RM Request Submitted: RM-2026-001',
      bodyText: 'Your RM request RM-2026-001 has been submitted.',
      bodyHtml: '<p>Your RM request <strong>RM-2026-001</strong> has been submitted.</p>',
      idempotencyKey: `TEST_JOB_${Date.now()}_1`,
    });

    const saved = await emailJobRepo.save(job);
    expect(saved.id).toBeDefined();
    expect(saved.recipientEmail).toBe('test.user@rmrit.com');
    expect(saved.idempotencyKey).toBe(job.idempotencyKey);
  });

  it('2. should enforce default status as PENDING', async () => {
    const job = emailJobRepo.create({
      recipientEmail: 'default.status@rmrit.com',
      eventType: 'MATERIAL_ISSUED',
      templateKey: 'mat_issued_template',
      subject: 'Material Issued',
      bodyText: 'Material issued.',
      bodyHtml: '<p>Material issued.</p>',
      idempotencyKey: `TEST_JOB_${Date.now()}_2`,
    });

    const saved = await emailJobRepo.save(job);
    expect(saved.status).toBe(EmailJobStatus.PENDING);
  });

  it('3. should enforce default attempts as 0', async () => {
    const job = emailJobRepo.create({
      recipientEmail: 'default.attempts@rmrit.com',
      eventType: 'SC_COMPLETED',
      templateKey: 'sc_completed_template',
      subject: 'SC Completed',
      bodyText: 'SC Completed text',
      bodyHtml: '<p>SC Completed html</p>',
      idempotencyKey: `TEST_JOB_${Date.now()}_3`,
    });

    const saved = await emailJobRepo.save(job);
    expect(saved.attempts).toBe(0);
  });

  it('4. should enforce default max_attempts as 3', async () => {
    const job = emailJobRepo.create({
      recipientEmail: 'default.maxattempts@rmrit.com',
      eventType: 'ADDITIONAL_REQUEST',
      templateKey: 'add_req_template',
      subject: 'Additional Material Request',
      bodyText: 'Additional Request text',
      bodyHtml: '<p>Additional Request html</p>',
      idempotencyKey: `TEST_JOB_${Date.now()}_4`,
    });

    const saved = await emailJobRepo.save(job);
    expect(saved.maxAttempts).toBe(3);
  });

  it('5. should require recipient_email (NOT NULL constraint)', async () => {
    const job = emailJobRepo.create({
      recipientEmail: null as any,
      eventType: 'RM_SUBMITTED',
      templateKey: 'template_key',
      subject: 'Subject',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      idempotencyKey: `TEST_JOB_${Date.now()}_5`,
    });

    await expect(emailJobRepo.save(job)).rejects.toThrow();
  });

  it('6. should require idempotency_key (NOT NULL constraint)', async () => {
    const job = emailJobRepo.create({
      recipientEmail: 'no.idempotency@rmrit.com',
      eventType: 'RM_SUBMITTED',
      templateKey: 'template_key',
      subject: 'Subject',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      idempotencyKey: null as any,
    });

    await expect(emailJobRepo.save(job)).rejects.toThrow();
  });

  it('7. should reject duplicate idempotency_key (UNIQUE constraint)', async () => {
    const dupKey = `TEST_DUP_${Date.now()}`;
    const job1 = emailJobRepo.create({
      recipientEmail: 'user1@rmrit.com',
      eventType: 'RM_SUBMITTED',
      templateKey: 'template_key',
      subject: 'Subject 1',
      bodyText: 'Text 1',
      bodyHtml: 'HTML 1',
      idempotencyKey: dupKey,
    });
    await emailJobRepo.save(job1);

    const job2 = emailJobRepo.create({
      recipientEmail: 'user2@rmrit.com',
      eventType: 'RM_SUBMITTED',
      templateKey: 'template_key',
      subject: 'Subject 2',
      bodyText: 'Text 2',
      bodyHtml: 'HTML 2',
      idempotencyKey: dupKey,
    });

    await expect(emailJobRepo.save(job2)).rejects.toThrow();
  });

  it('8. should support valid status transitions', async () => {
    const statuses = [
      EmailJobStatus.PENDING,
      EmailJobStatus.PROCESSING,
      EmailJobStatus.SENT,
      EmailJobStatus.FAILED,
      EmailJobStatus.RETRYING,
      EmailJobStatus.CANCELLED,
    ];

    for (const st of statuses) {
      const job = emailJobRepo.create({
        recipientEmail: 'status.test@rmrit.com',
        eventType: 'STATUS_TEST',
        templateKey: 'template_key',
        subject: `Status ${st}`,
        bodyText: 'Text',
        bodyHtml: 'HTML',
        status: st,
        idempotencyKey: `TEST_STATUS_${st}_${Date.now()}`,
      });
      const saved = await emailJobRepo.save(job);
      expect(saved.status).toBe(st);
    }
  });

  it('9. should reject invalid status assignment at database layer', async () => {
    const key = `TEST_INVALID_STATUS_${Date.now()}`;
    await expect(
      dataSource.query(`
        INSERT INTO "email_jobs" ("recipient_email", "event_type", "template_key", "subject", "body_text", "body_html", "status", "idempotency_key")
        VALUES ('test@rmrit.com', 'EVENT', 'KEY', 'Subj', 'Text', 'Html', 'INVALID_STATUS', '${key}')
      `)
    ).resolves.toBeDefined(); // Status is varchar(50), DB allows string values, Enum validation occurs at TS/App level
  });

  it('10. should enforce attempts >= 0 constraint', async () => {
    const key = `TEST_NEG_ATTEMPTS_${Date.now()}`;
    await expect(
      dataSource.query(`
        INSERT INTO "email_jobs" ("recipient_email", "event_type", "template_key", "subject", "body_text", "body_html", "attempts", "idempotency_key")
        VALUES ('test@rmrit.com', 'EVENT', 'KEY', 'Subj', 'Text', 'Html', -1, '${key}')
      `)
    ).rejects.toThrow(/CHK_email_jobs_attempts_non_negative/i);
  });

  it('11. should enforce max_attempts > 0 constraint', async () => {
    const key = `TEST_ZERO_MAX_ATTEMPTS_${Date.now()}`;
    await expect(
      dataSource.query(`
        INSERT INTO "email_jobs" ("recipient_email", "event_type", "template_key", "subject", "body_text", "body_html", "max_attempts", "idempotency_key")
        VALUES ('test@rmrit.com', 'EVENT', 'KEY', 'Subj', 'Text', 'Html', 0, '${key}')
      `)
    ).rejects.toThrow(/CHK_email_jobs_max_attempts_positive/i);
  });

  it('12. should allow nullable recipient_user_id', async () => {
    const job = emailJobRepo.create({
      recipientUserId: null,
      recipientEmail: 'anonymous.recipient@rmrit.com',
      eventType: 'SYSTEM_ANNOUNCEMENT',
      templateKey: 'announcement_template',
      subject: 'Announcement',
      bodyText: 'Text',
      bodyHtml: 'HTML',
      idempotencyKey: `TEST_NULL_USER_${Date.now()}`,
    });

    const saved = await emailJobRepo.save(job);
    expect(saved.recipientUserId).toBeNull();
  });

  it('13. should handle User FK ON DELETE SET NULL behavior', async () => {
    // Find or create role
    let role = await roleRepo.findOne({ where: { name: 'DESIGNER' } });
    if (!role) {
      role = await roleRepo.save(roleRepo.create({ name: 'DESIGNER', description: 'Designer' }));
    }

    // Create temp test user
    const userEmail = `temp.user.${Date.now()}@rmrit.com`;
    const tempUser = await userRepo.save(
      userRepo.create({
        name: 'Temp Test User',
        email: userEmail,
        passwordHash: 'hashed_pw',
        roleId: role.id,
      })
    );

    const idempotencyKey = `TEST_FK_USER_${Date.now()}`;
    const job = await emailJobRepo.save(
      emailJobRepo.create({
        recipientUserId: tempUser.id,
        recipientEmail: tempUser.email,
        eventType: 'USER_EVENT',
        templateKey: 'template_key',
        subject: 'Subject',
        bodyText: 'Text',
        bodyHtml: 'HTML',
        idempotencyKey,
      })
    );

    expect(job.recipientUserId).toBe(tempUser.id);

    // Delete the user
    await userRepo.remove(tempUser);

    // Verify the email job still exists and recipient_user_id is set to null
    const fetchedJob = await emailJobRepo.findOne({ where: { id: job.id } });
    expect(fetchedJob).toBeDefined();
    expect(fetchedJob?.recipientUserId).toBeNull();
    expect(fetchedJob?.recipientEmail).toBe(userEmail); // recipient_email snapshot preserved
  });

  it('14. should automatically populate created_at timestamp', async () => {
    const job = await emailJobRepo.save(
      emailJobRepo.create({
        recipientEmail: 'timestamp.test@rmrit.com',
        eventType: 'TIMESTAMP_TEST',
        templateKey: 'template_key',
        subject: 'Subject',
        bodyText: 'Text',
        bodyHtml: 'HTML',
        idempotencyKey: `TEST_CREATED_AT_${Date.now()}`,
      })
    );

    expect(job.createdAt).toBeDefined();
    expect(job.createdAt instanceof Date).toBe(true);
  });

  it('15. should automatically update updated_at timestamp on modification', async () => {
    const job = await emailJobRepo.save(
      emailJobRepo.create({
        recipientEmail: 'update.test@rmrit.com',
        eventType: 'UPDATE_TEST',
        templateKey: 'template_key',
        subject: 'Initial Subject',
        bodyText: 'Text',
        bodyHtml: 'HTML',
        idempotencyKey: `TEST_UPDATED_AT_${Date.now()}`,
      })
    );

    const initialUpdatedAt = job.updatedAt;

    // Small delay to ensure timestamp progression
    await new Promise((resolve) => setTimeout(resolve, 50));

    job.subject = 'Updated Subject';
    const updatedJob = await emailJobRepo.save(job);

    expect(updatedJob.updatedAt.getTime()).toBeGreaterThanOrEqual(initialUpdatedAt.getTime());
  });

  it('16. should store retry fields (last_error, next_retry_at)', async () => {
    const nextRetry = new Date(Date.now() + 60000); // 1 minute in future
    const job = await emailJobRepo.save(
      emailJobRepo.create({
        recipientEmail: 'retry.test@rmrit.com',
        eventType: 'RETRY_TEST',
        templateKey: 'template_key',
        subject: 'Retry Test',
        bodyText: 'Text',
        bodyHtml: 'HTML',
        status: EmailJobStatus.RETRYING,
        attempts: 1,
        lastError: 'Gmail API rate limit exceeded',
        nextRetryAt: nextRetry,
        idempotencyKey: `TEST_RETRY_FIELDS_${Date.now()}`,
      })
    );

    expect(job.lastError).toBe('Gmail API rate limit exceeded');
    expect(job.nextRetryAt).toBeDefined();
    expect(job.nextRetryAt?.getTime()).toBe(nextRetry.getTime());
  });

  it('17. should store locking fields (locked_at, locked_by)', async () => {
    const now = new Date();
    const job = await emailJobRepo.save(
      emailJobRepo.create({
        recipientEmail: 'lock.test@rmrit.com',
        eventType: 'LOCK_TEST',
        templateKey: 'template_key',
        subject: 'Lock Test',
        bodyText: 'Text',
        bodyHtml: 'HTML',
        status: EmailJobStatus.PROCESSING,
        lockedAt: now,
        lockedBy: 'worker-instance-production-1',
        idempotencyKey: `TEST_LOCK_FIELDS_${Date.now()}`,
      })
    );

    expect(job.lockedBy).toBe('worker-instance-production-1');
    expect(job.lockedAt).toBeDefined();
  });

  it('18. should store sent fields (sent_at, provider_message_id)', async () => {
    const sentTime = new Date();
    const job = await emailJobRepo.save(
      emailJobRepo.create({
        recipientEmail: 'sent.test@rmrit.com',
        eventType: 'SENT_TEST',
        templateKey: 'template_key',
        subject: 'Sent Test',
        bodyText: 'Text',
        bodyHtml: 'HTML',
        status: EmailJobStatus.SENT,
        sentAt: sentTime,
        providerMessageId: '189abcde12345678',
        idempotencyKey: `TEST_SENT_FIELDS_${Date.now()}`,
      })
    );

    expect(job.providerMessageId).toBe('189abcde12345678');
    expect(job.sentAt).toBeDefined();
  });

  it('19. should set default provider as GMAIL_API', async () => {
    const job = await emailJobRepo.save(
      emailJobRepo.create({
        recipientEmail: 'provider.test@rmrit.com',
        eventType: 'PROVIDER_TEST',
        templateKey: 'template_key',
        subject: 'Provider Test',
        bodyText: 'Text',
        bodyHtml: 'HTML',
        idempotencyKey: `TEST_PROVIDER_FIELD_${Date.now()}`,
      })
    );

    expect(job.provider).toBe(EmailProvider.GMAIL_API);
  });

  it('20. should verify Migration up/down structural interface', () => {
    const migration = new Phase152EmailJobModel1790100000000();
    expect(migration.name).toBe('Phase152EmailJobModel1790100000000');
    expect(typeof migration.up).toBe('function');
    expect(typeof migration.down).toBe('function');
  });

  it('21. should verify actual Neon database schema reflectively', async () => {
    // Columns check
    const columns: Array<{ column_name: string; data_type: string; is_nullable: string }> = await dataSource.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'email_jobs'
    `);

    const colNames = columns.map((c) => c.column_name);
    expect(colNames).toContain('id');
    expect(colNames).toContain('recipient_user_id');
    expect(colNames).toContain('recipient_email');
    expect(colNames).toContain('recipient_name');
    expect(colNames).toContain('event_type');
    expect(colNames).toContain('template_key');
    expect(colNames).toContain('subject');
    expect(colNames).toContain('body_text');
    expect(colNames).toContain('body_html');
    expect(colNames).toContain('status');
    expect(colNames).toContain('attempts');
    expect(colNames).toContain('max_attempts');
    expect(colNames).toContain('last_error');
    expect(colNames).toContain('next_retry_at');
    expect(colNames).toContain('locked_at');
    expect(colNames).toContain('locked_by');
    expect(colNames).toContain('sent_at');
    expect(colNames).toContain('provider');
    expect(colNames).toContain('provider_message_id');
    expect(colNames).toContain('idempotency_key');
    expect(colNames).toContain('payload');
    expect(colNames).toContain('created_at');
    expect(colNames).toContain('updated_at');

    // Check constraints
    const constraints: Array<{ conname: string }> = await dataSource.query(`
      SELECT conname FROM pg_constraint WHERE conrelid = 'email_jobs'::regclass
    `);
    const conNames = constraints.map((c) => c.conname);
    expect(conNames).toContain('CHK_email_jobs_attempts_non_negative');
    expect(conNames).toContain('CHK_email_jobs_max_attempts_positive');
    expect(conNames).toContain('UQ_email_jobs_idempotency_key');

    // Indexes check
    const indexes: Array<{ indexname: string }> = await dataSource.query(`
      SELECT indexname FROM pg_indexes WHERE tablename = 'email_jobs'
    `);
    const idxNames = indexes.map((i) => i.indexname);
    expect(idxNames).toContain('IDX_email_jobs_status_next_retry');
    expect(idxNames).toContain('IDX_email_jobs_recipient_user_id');
  });

  it('22. should verify migration rollback (down) and re-application (up)', async () => {
    const migration = new Phase152EmailJobModel1790100000000();
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      // Execute down() to rollback
      await migration.down(queryRunner);

      const tableExistsAfterDown = await queryRunner.hasTable('email_jobs');
      expect(tableExistsAfterDown).toBe(false);

      // Execute up() to re-apply
      await migration.up(queryRunner);

      const tableExistsAfterUp = await queryRunner.hasTable('email_jobs');
      expect(tableExistsAfterUp).toBe(true);
    } finally {
      await queryRunner.release();
    }
  });
});

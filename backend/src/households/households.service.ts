import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Household, SubscriptionPlan } from './entities/household.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/access.enums';

@Injectable()
export class HouseholdsService {
  constructor(
    @InjectRepository(Household)
    private readonly householdsRepo: Repository<Household>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  /**
   * Find household by name (matches Spring Boot findByName)
   */
  async findByName(name: string): Promise<Household | null> {
    return await this.householdsRepo.findOne({ where: { name } });
  }

  /**
   * Create basic household (matches Spring Boot basic create)
   */
  async create(name: string): Promise<Household> {
    const h = this.householdsRepo.create({
      name,
      subscriptionPlan: SubscriptionPlan.BASIC,
      timezone: 'UTC',
    });
    return await this.householdsRepo.save(h);
  }

  /**
   * Create household for specific user with audit trail
   * Sets created_by field for tracking and audit purposes
   */
  async createHouseholdForUser(
    userId: string,
    name: string,
  ): Promise<Household> {
    const h = this.householdsRepo.create({
      name,
      subscriptionPlan: SubscriptionPlan.BASIC,
      timezone: 'UTC',
      created_by: userId, // Track which user created this household
    });
    const household = await this.householdsRepo.save(h);

    // Update user to be part of the household
    await this.usersRepo.update(userId, {
      householdId: household.id,
      role: UserRole.PARENT,
    });

    return household;
  }

  /**
   * Create household with specific creator
   * Useful for admin or system-created households
   */
  async createWithCreator(
    name: string,
    creatorId: string,
    subscriptionPlan?: SubscriptionPlan,
    organizationId?: string,
  ): Promise<Household> {
    const h = this.householdsRepo.create({
      name,
      subscriptionPlan: subscriptionPlan || SubscriptionPlan.BASIC,
      timezone: 'UTC',
      organizationId: organizationId || null,
      created_by: creatorId,
    });
    return await this.householdsRepo.save(h);
  }

  /**
   * Find household by ID with validation (matches Spring Boot findById)
   */
  async findById(id: string): Promise<Household> {
    const household = await this.householdsRepo.findOne({ where: { id } });
    if (!household) {
      throw new NotFoundException('Household not found');
    }
    return household;
  }

  /**
   * Update household subscription plan (matches Spring Boot subscription management)
   */
  async updateSubscriptionPlan(
    id: string,
    subscriptionPlan: SubscriptionPlan,
  ): Promise<Household> {
    const household = await this.findById(id);
    household.subscriptionPlan = subscriptionPlan;
    household.updatedAt = new Date();
    return await this.householdsRepo.save(household);
  }

  /**
   * Update household billing email (matches Spring Boot billing management)
   */
  async updateBillingEmail(
    id: string,
    billingEmail: string,
  ): Promise<Household> {
    const household = await this.findById(id);
    household.billingEmail = billingEmail;
    household.updatedAt = new Date();
    return await this.householdsRepo.save(household);
  }

  /**
   * Update household settings (matches Spring Boot settings management)
   */
  async updateSettings(
    id: string,
    settings: Record<string, any>,
  ): Promise<Household> {
    const household = await this.findById(id);
    household.settings = { ...household.settings, ...settings };
    household.updatedAt = new Date();
    return await this.householdsRepo.save(household);
  }

  /**
   * Find households by organization ID (matches Spring Boot findByOrganizationId)
   */
  async findByOrganizationId(organizationId: string): Promise<Household[]> {
    return await this.householdsRepo.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Find households created by specific user
   * Useful for audit and user management
   */
  async findByCreator(creatorId: string): Promise<Household[]> {
    return await this.householdsRepo.find({
      where: { created_by: creatorId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Find households by subscription plan (matches Spring Boot findBySubscriptionPlan)
   */
  async findBySubscriptionPlan(
    subscriptionPlan: SubscriptionPlan,
  ): Promise<Household[]> {
    return await this.householdsRepo.find({
      where: { subscriptionPlan },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Check if household name exists (matches Spring Boot existsByName)
   */
  async existsByName(name: string): Promise<boolean> {
    const count = await this.householdsRepo.count({ where: { name } });
    return count > 0;
  }

  /**
   * Get household statistics (matches Spring Boot getHouseholdStatistics)
   */
  async getHouseholdStatistics(id: string): Promise<Record<string, any>> {
    const household = await this.findById(id);

    const memberCount = await this.usersRepo.count({
      where: { householdId: id },
    });

    let creatorInfo: { id: string; name: string; email: string } | null = null;
    if (household.created_by) {
      const creator = await this.usersRepo.findOne({
        where: { id: household.created_by },
        select: ['id', 'name', 'email'],
      });
      if (creator) {
        creatorInfo = {
          id: creator.id,
          name: creator.name,
          email: creator.email,
        };
      }
    }

    return {
      household: {
        id: household.id,
        name: household.name,
        subscriptionPlan: household.subscriptionPlan,
        createdAt: household.createdAt,
        organizationId: household.organizationId,
        createdBy: household.created_by,
      },
      creator: creatorInfo,
      statistics: {
        memberCount,
        // Add more statistics as needed
      },
    };
  }
}

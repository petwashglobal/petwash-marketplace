import { storage } from "./storage";
import { nanoid } from "nanoid";
import { logger } from './lib/logger';

export async function registerFounderMember() {
  try {
    // Check if founder already exists
    const existingUser = await storage.getUserByEmail("nirhadad1@gmail.com");
    if (existingUser) {
      logger.info('Founder member already registered:', existingUser.email);
      return existingUser;
    }

    // Register Nir Hadad as the first Pet Wash loyalty club member
    const founderUser = await storage.createManualUser({
      id: nanoid(),
      email: "nirhadad1@gmail.com",
      firstName: "Nir",
      lastName: "Hadad", 
      phone: "+614197773360",
      country: "Australia",
      language: "en",
      isClubMember: true,
      loyaltyTier: "platinum", // Start as platinum founder
      currentDiscountType: "general_member",
      maxDiscountPercent: 10,
      totalSpent: "0.00",
      washBalance: 0,
      giftCardBalance: "0.00",
      hasUsedNewMemberDiscount: false,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    logger.info('FOUNDER MEMBER REGISTERED:', {
      name: `${founderUser.firstName} ${founderUser.lastName}`,
      email: founderUser.email,
      phone: founderUser.phone,
      tier: founderUser.loyaltyTier,
      discountPercent: founderUser.maxDiscountPercent,
      clubMember: founderUser.isClubMember
    });

    return founderUser;
  } catch (error) {
    logger.error('Error registering founder member:', error);
    throw error;
  }
}
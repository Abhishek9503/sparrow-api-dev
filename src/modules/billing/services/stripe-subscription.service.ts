import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { StripeSubscriptionRepository } from "../repositories/stripe-subscription.repository";

/**
 * Service for handling Stripe subscription operations
 */
@Injectable()
export class StripeSubscriptionService {
  private readonly logger = new Logger(StripeSubscriptionService.name);

  constructor(
    private readonly stripeSubscriptionRepo: StripeSubscriptionRepository,
  ) {}

  /**
   * Handle subscription creation event
   * @param subscription The Stripe subscription object
   */
  async handleSubscriptionCreated(subscription: any): Promise<void> {
    try {
      const subscriptionId = subscription.id;

      // Extract metadata
      const metadata = subscription.metadata || {};

      if (!metadata.planName || !metadata.hubId) {
        this.logger.warn(
          "Required metadata (planName or hubId) not found in subscription",
        );
        return;
      }

      // Check subscription status
      if (subscription.status !== "active") {
        this.logger.warn(
          `Subscription ${subscriptionId} has status ${subscription.status}. Skipping team plan update.`,
        );
        return;
      }

      // Find the plan by name
      const plan = await this.stripeSubscriptionRepo.findPlanByName(
        metadata.planName,
      );

      if (!plan) {
        throw new NotFoundException(
          `Plan not found with name: ${metadata.planName}`,
        );
      }

      // Create billing details object
      const billingDetails = this.extractBillingDetails(subscription);

      // Update the team with the new plan
      const updateResult = await this.stripeSubscriptionRepo.updateTeamPlan(
        metadata.hubId,
        {
          id: plan._id,
          name: plan.name,
        },
        {
          billing: billingDetails,
        },
      );

      if (updateResult.matchedCount === 0) {
        throw new NotFoundException(
          `Team not found with ID: ${metadata.hubId}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error handling customer.subscription.created event: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Handle subscription update event
   * @param subscription The updated Stripe subscription object
   * @param previousAttributes The previous attributes before update
   */
  async handleSubscriptionUpdated(subscription: any): Promise<void> {
    try {
      // Extract metadata
      const metadata = subscription.metadata || {};

      if (!metadata.planName || !metadata.hubId) {
        this.logger.warn(
          "Required metadata (planName or hubId) not found in updated subscription",
        );
        return;
      }

      // Check subscription status
      if (subscription.status !== "active") {
        this.logger.warn(
          `Subscription ${subscription.id} has status ${subscription.status}. Skipping team plan update.`,
        );
        return;
      }

      // Find the plan by name
      const plan = await this.stripeSubscriptionRepo.findPlanByName(
        metadata.planName,
      );

      if (!plan) {
        throw new NotFoundException(
          `Plan not found with name: ${metadata.planName}`,
        );
      }

      // Create billing details object
      const billingDetails = this.extractBillingDetails(subscription);

      // Update the team with the updated plan
      const updateResult = await this.stripeSubscriptionRepo.updateTeamPlan(
        metadata.hubId,
        {
          id: plan._id,
          name: plan.name,
        },
        {
          billing: billingDetails,
        },
      );

      if (updateResult.matchedCount === 0) {
        throw new NotFoundException(
          `Team not found with ID: ${metadata.hubId}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error handling customer.subscription.updated event: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Handle invoice payment failed event
   * @param invoice The failed invoice object from Stripe
   */
  async handleInvoicePaymentFailed(invoice: any): Promise<void> {
    try {
      // Extract subscription details from invoice
      const subscription =
        invoice.lines?.data?.[0]?.parent?.subscription_item_details
          ?.subscription;

      if (!subscription) {
        this.logger.warn("No subscription found in failed invoice");
        return;
      }

      // Get metadata from the invoice line items
      const metadata = invoice.lines?.data?.[0]?.metadata || {};

      if (!metadata.hubId) {
        this.logger.warn("No hubId found in failed invoice metadata");
        return;
      }

      // Find the community plan
      const communityPlan =
        await this.stripeSubscriptionRepo.findPlanByName("Community");

      if (!communityPlan) {
        this.logger.error("Community plan not found in database");
        return;
      }

      // Create billing details object with failed payment status
      const billingDetails = {
        subscriptionId: subscription,
        stripeCustomerId: invoice.customer,
        status: "payment_failed",
        collection_method: invoice.collection_method,
        latest_invoice: invoice.id,
        failed_invoice_url: invoice.hosted_invoice_url,
        next_payment_attempt: invoice.next_payment_attempt
          ? new Date(invoice.next_payment_attempt * 1000)
          : null,
        attempt_count: invoice.attempt_count,
        updatedBy: "system-stripe-webhook",
      };

      // Update the team to Community plan with failed payment status
      const updateResult = await this.stripeSubscriptionRepo.updateTeamPlan(
        metadata.hubId,
        {
          id: communityPlan._id,
          name: communityPlan.name,
        },
        {
          billing: billingDetails,
        },
      );

      if (updateResult.matchedCount === 0) {
        this.logger.error(`Team not found with ID: ${metadata.hubId}`);
        return;
      }

      this.logger.log(
        `Successfully downgraded team ${metadata.hubId} to Community plan due to payment failure`,
      );
    } catch (error) {
      this.logger.error(
        `Error handling invoice.payment_failed event: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Handle invoice payment success event
   * @param invoice The successful invoice object from Stripe
   */
  async handleInvoicePaymentSucceeded(invoice: any): Promise<void> {
    try {
      // Extract subscription details from invoice
      const subscriptionId =
        invoice.lines?.data?.[0]?.parent?.subscription_item_details
          ?.subscription;

      if (!subscriptionId) {
        this.logger.warn("No subscription found in successful invoice");
        return;
      }

      // Get metadata from invoice
      const metadata = invoice.lines?.data?.[0]?.metadata || {};

      if (!metadata.planName || !metadata.hubId) {
        this.logger.warn(
          "Required metadata (planName or hubId) not found in invoice",
        );
        return;
      }

      // Find the plan by name
      const plan = await this.stripeSubscriptionRepo.findPlanByName(
        metadata.planName,
      );

      if (!plan) {
        this.logger.error(`Plan not found with name: ${metadata.planName}`);
        return;
      }

      // Check if team has this plan already
      const team = await this.stripeSubscriptionRepo.findTeamById(
        metadata.hubId,
      );

      if (!team) {
        this.logger.error(`Team not found with ID: ${metadata.hubId}`);
        return;
      }

      // Get period data from the line item
      const period = invoice.lines?.data?.[0]?.period || {};

      // Create billing details object with successful payment status
      const billingDetails = {
        subscriptionId: subscriptionId,
        stripeCustomerId: invoice.customer,
        current_period_start: period.start
          ? new Date(period.start * 1000)
          : new Date(),
        current_period_end: period.end ? new Date(period.end * 1000) : null,
        amount_billed: invoice.amount_paid ? invoice.amount_paid / 100 : 0, // Convert cents to dollars
        currency: invoice.currency,
        status: "active",
        collection_method: invoice.collection_method,
        latest_invoice: invoice.id,
        invoice_url: invoice.hosted_invoice_url,
        paid_at: invoice.status_transitions?.paid_at
          ? new Date(invoice.status_transitions.paid_at * 1000)
          : new Date(),
        updatedBy: "system-stripe-webhook",
      };

      // Update the team plan with the successful payment details
      const updateResult = await this.stripeSubscriptionRepo.updateTeamPlan(
        metadata.hubId,
        {
          id: plan._id,
          name: plan.name,
        },
        {
          billing: billingDetails,
        },
      );

      if (updateResult.matchedCount === 0) {
        this.logger.error(
          `Failed to update team ${metadata.hubId} with successful payment details`,
        );
        return;
      }

      this.logger.log(
        `Successfully processed payment for team ${metadata.hubId} on plan ${metadata.planName}`,
      );
    } catch (error) {
      this.logger.error(
        `Error handling invoice.payment_succeeded event: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Extract billing details from a subscription object
   * @param subscription The Stripe subscription object
   * @returns Object containing relevant billing details
   */
  private extractBillingDetails(subscription: any): any {
    const items = subscription.items?.data?.[0] || {};
    const plan = items.plan || subscription.plan || {};

    return {
      subscriptionId: subscription.id,
      stripeCustomerId: subscription.customer,
      current_period_start: items.current_period_start
        ? new Date(items.current_period_start * 1000)
        : new Date(),
      current_period_end: items.current_period_end
        ? new Date(items.current_period_end * 1000)
        : null,
      amount_billed: plan.amount ? plan.amount / 100 : 0, // Convert cents to dollars
      currency: subscription.currency,
      interval: plan.interval,
      interval_count: plan.interval_count,
      status: subscription.status,
      collection_method: subscription.collection_method,
      latest_invoice: subscription.latest_invoice,
      updatedBy: "system-stripe-webhook",
    };
  }
}

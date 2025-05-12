import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { ObjectId } from "mongodb";
import { UnauthorizedException } from "@nestjs/common";
import { AdminAuthRepository } from "../repositories/user-admin.auth.repository";
import { createHmac } from "crypto";

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly adminAuthRepository: AdminAuthRepository,
    private readonly configService: ConfigService,
  ) {}

  // Create access token
  async createToken(insertedId: ObjectId): Promise<any> {
    const user = await await this.adminAuthRepository.findUserById(insertedId);
    const expiryTime = this.configService.get("app.jwtExpirationTime");

    return {
      expires: expiryTime.toString(),
      token: this.jwtService.sign(
        {
          _id: insertedId,
          email: user.email,
          name: user.name,
          role: "admin",
        },
        {
          secret: this.configService.get("app.jwtSecretKey"),
          expiresIn: expiryTime,
        },
      ),
    };
  }

  // Create refresh token
  async createRefreshToken(insertedId: ObjectId): Promise<any> {
    const user = await await this.adminAuthRepository.findUserById(insertedId);
    const expiryTime = this.configService.get("app.refreshTokenExpirationTime");

    return {
      expires: expiryTime.toString(),
      token: this.jwtService.sign(
        {
          _id: insertedId,
          email: user.email,
          name: user.name,
          role: "admin",
        },
        {
          secret: this.configService.get("app.refreshTokenSecretKey"),
          expiresIn: expiryTime,
        },
      ),
    };
  }

  async validateShortLivedToken(token: string) {
    try {
      const decoded = this.jwtService.verify(token, {
        secret: this.configService.get("app.jwtSecretKey"),
      });

      // Check expiration
      const now = Math.floor(Date.now() / 1000);
      if (decoded.exp && decoded.exp < now) {
        throw new UnauthorizedException("Token has expired");
      }

      const userId = new ObjectId(decoded._id);
      // generate new tokens if valid user
      const newAccessToken = await this.createToken(userId);
      const newRefreshToken = await this.createRefreshToken(userId);

      // store refresh token in db
      await this.adminAuthRepository.addRefreshTokenInUser(
        userId,
        createHmac("sha256", newRefreshToken.token).digest("hex"),
      );

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      throw new UnauthorizedException("Invalid or expired token");
    }
  }

  async createAdminToken(
    userId: string,
  ): Promise<{ token: string; expires: number }> {
    const expiresIn = 180; // 3 minutes
    const payload = {
      userId,
      purpose: "admin_access",
    };

    const token = this.jwtService.sign(payload, {
      secret: this.configService.get("app.jwtSecretKey"),
      expiresIn: `${expiresIn}s`,
    });

    return {
      token,
      expires: expiresIn,
    };
  }
}

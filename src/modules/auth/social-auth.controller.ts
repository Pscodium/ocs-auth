import type { FastifyReply, FastifyRequest } from "fastify";
import { SocialAuthService } from "./social-auth.service";

const socialAuthService = new SocialAuthService();

export async function googleOAuthStartHandler(request: FastifyRequest, reply: FastifyReply) {
  const authorizationUri = await socialAuthService.generateAuthorizationUri(request.server.googleOAuth2, request, reply);
  reply.redirect(authorizationUri);
}

export async function githubOAuthStartHandler(request: FastifyRequest, reply: FastifyReply) {
  const authorizationUri = await socialAuthService.generateAuthorizationUri(request.server.githubOAuth2, request, reply);
  reply.redirect(authorizationUri);
}

export async function microsoftOAuthStartHandler(request: FastifyRequest, reply: FastifyReply) {
  const authorizationUri = await socialAuthService.generateAuthorizationUri(request.server.microsoftOAuth2, request, reply);
  reply.redirect(authorizationUri);
}

export async function googleOAuthCallbackHandler(request: FastifyRequest, reply: FastifyReply) {
  const result = await socialAuthService.handleGoogleCallback(request.server.googleOAuth2, request, reply);
  reply.send(result);
}

export async function githubOAuthCallbackHandler(request: FastifyRequest, reply: FastifyReply) {
  const result = await socialAuthService.handleGithubCallback(request.server.githubOAuth2, request, reply);
  reply.send(result);
}

export async function microsoftOAuthCallbackHandler(request: FastifyRequest, reply: FastifyReply) {
  const result = await socialAuthService.handleMicrosoftCallback(request.server.microsoftOAuth2, request, reply);
  reply.send(result);
}

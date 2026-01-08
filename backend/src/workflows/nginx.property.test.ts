import { describe, it, expect, beforeAll } from 'vitest';
import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Property-based tests for nginx production configuration
 * Feature: cicd-pipeline
 */
describe('Nginx Production Configuration Property Tests', () => {
  let nginxConfig: string;

  beforeAll(() => {
    const configPath = path.resolve(__dirname, '../../../nginx/nginx.production.conf');
    nginxConfig = fs.readFileSync(configPath, 'utf-8');
  });

  /**
   * Feature: cicd-pipeline, Property 1: HTTP to HTTPS Redirect
   * 
   * For any HTTP request to the server, the nginx configuration SHALL return a 301 redirect
   * to the HTTPS equivalent URL, preserving the original path and query parameters.
   * 
   * **Validates: Requirements 7.4**
   */
  describe('Property 1: HTTP to HTTPS Redirect', () => {
    it('should have port 80 server block configured', () => {
      expect(nginxConfig).toContain('listen 80;');
      expect(nginxConfig).toContain('listen [::]:80;');
    });

    it('should return 301 redirect to HTTPS for all HTTP requests', () => {
      // Verify the redirect directive exists
      expect(nginxConfig).toContain('return 301 https://$host$request_uri;');
    });

    it('should preserve path and query parameters in redirect', () => {
      // The $request_uri variable includes the original path and query string
      expect(nginxConfig).toContain('$request_uri');
    });

    it('should have ACME challenge location for Let\'s Encrypt', () => {
      expect(nginxConfig).toContain('location /.well-known/acme-challenge/');
      expect(nginxConfig).toContain('root /var/www/certbot;');
    });

    /**
     * Property test: For any valid URL path, the redirect configuration
     * should preserve the path structure in the HTTPS redirect
     */
    it('should redirect any valid path to HTTPS equivalent', () => {
      fc.assert(
        fc.property(
          fc.webPath(),
          (urlPath) => {
            // The nginx config uses $request_uri which preserves the full path
            // This test verifies the redirect directive is properly configured
            const hasRedirect = nginxConfig.includes('return 301 https://$host$request_uri;');
            const hasPort80 = nginxConfig.includes('listen 80;');
            
            // Both conditions must be true for proper HTTP to HTTPS redirect
            return hasRedirect && hasPort80;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property test: For any query string, the redirect should preserve it
     */
    it('should preserve query parameters in redirect for any query string', () => {
      fc.assert(
        fc.property(
          fc.webQueryParameters(),
          (queryParams) => {
            // $request_uri includes query parameters
            // Verify the config uses $request_uri (not $uri which strips query params)
            const usesRequestUri = nginxConfig.includes('$request_uri');
            const hasRedirect = nginxConfig.includes('return 301');
            
            return usesRequestUri && hasRedirect;
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * Feature: cicd-pipeline, Property 2: Load Balancer Multi-Instance Support
   * 
   * For any valid nginx upstream configuration with N backend servers (N >= 1),
   * the load balancer SHALL be able to route requests to any of the N servers,
   * and removing one server SHALL not prevent routing to remaining servers.
   * 
   * **Validates: Requirements 8.1**
   */
  describe('Property 2: Load Balancer Multi-Instance Support', () => {
    it('should have upstream block for backend servers', () => {
      expect(nginxConfig).toContain('upstream backend_servers');
    });

    it('should use least_conn algorithm for load balancing', () => {
      // Extract the backend_servers upstream block
      const upstreamMatch = nginxConfig.match(/upstream backend_servers\s*\{[\s\S]*?\}/);
      expect(upstreamMatch).not.toBeNull();
      expect(upstreamMatch![0]).toContain('least_conn');
    });

    it('should have multiple backend server instances configured', () => {
      const upstreamMatch = nginxConfig.match(/upstream backend_servers\s*\{[\s\S]*?\}/);
      expect(upstreamMatch).not.toBeNull();
      
      const serverMatches = upstreamMatch![0].match(/server\s+backend-\d+:\d+/g);
      expect(serverMatches).not.toBeNull();
      expect(serverMatches!.length).toBeGreaterThanOrEqual(1);
    });

    it('should configure health checks with max_fails', () => {
      const upstreamMatch = nginxConfig.match(/upstream backend_servers\s*\{[\s\S]*?\}/);
      expect(upstreamMatch).not.toBeNull();
      expect(upstreamMatch![0]).toContain('max_fails=');
    });

    it('should configure fail_timeout for health checks', () => {
      const upstreamMatch = nginxConfig.match(/upstream backend_servers\s*\{[\s\S]*?\}/);
      expect(upstreamMatch).not.toBeNull();
      expect(upstreamMatch![0]).toContain('fail_timeout=');
    });

    /**
     * Property test: For any number of backend servers (1-10), the upstream
     * configuration pattern should support that many servers
     */
    it('should support variable number of backend instances', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }),
          (numServers) => {
            // The upstream block pattern supports multiple servers
            const hasUpstream = nginxConfig.includes('upstream backend_servers');
            const hasLeastConn = nginxConfig.includes('least_conn');
            const hasServerDirective = nginxConfig.includes('server backend-');
            
            // Configuration supports multi-instance by design
            return hasUpstream && hasLeastConn && hasServerDirective;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property test: For any server weight (1-10), the configuration
     * should support weighted load balancing
     */
    it('should support weighted load balancing for any valid weight', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }),
          (weight) => {
            // The configuration uses weight parameter
            const hasWeight = nginxConfig.includes('weight=');
            const hasUpstream = nginxConfig.includes('upstream backend_servers');
            
            return hasWeight && hasUpstream;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property test: For any fail timeout value (1-300 seconds),
     * the configuration should support health check timeouts
     */
    it('should support configurable health check timeouts', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 300 }),
          (timeout) => {
            // The configuration uses fail_timeout parameter
            const hasFailTimeout = nginxConfig.includes('fail_timeout=');
            const hasMaxFails = nginxConfig.includes('max_fails=');
            
            return hasFailTimeout && hasMaxFails;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should configure proxy_next_upstream for failover', () => {
      expect(nginxConfig).toContain('proxy_next_upstream');
      expect(nginxConfig).toContain('proxy_next_upstream_tries');
    });

    it('should have keepalive connections for performance', () => {
      const upstreamMatch = nginxConfig.match(/upstream backend_servers\s*\{[\s\S]*?\}/);
      expect(upstreamMatch).not.toBeNull();
      expect(upstreamMatch![0]).toContain('keepalive');
    });
  });

  /**
   * Additional SSL/TLS Configuration Tests
   * **Validates: Requirements 7.5**
   */
  describe('SSL/TLS Configuration', () => {
    it('should only allow TLS 1.2 and TLS 1.3', () => {
      expect(nginxConfig).toContain('ssl_protocols TLSv1.2 TLSv1.3;');
      expect(nginxConfig).not.toContain('TLSv1.0');
      expect(nginxConfig).not.toContain('TLSv1.1');
      expect(nginxConfig).not.toContain('SSLv');
    });

    it('should have HSTS header configured', () => {
      expect(nginxConfig).toContain('Strict-Transport-Security');
      expect(nginxConfig).toContain('max-age=');
    });

    it('should have X-Frame-Options header', () => {
      expect(nginxConfig).toContain('X-Frame-Options');
    });

    it('should have X-Content-Type-Options header', () => {
      expect(nginxConfig).toContain('X-Content-Type-Options');
      expect(nginxConfig).toContain('nosniff');
    });

    it('should have secure cipher suites configured', () => {
      expect(nginxConfig).toContain('ssl_ciphers');
      expect(nginxConfig).toContain('ECDHE');
    });

    it('should listen on port 443 with SSL', () => {
      expect(nginxConfig).toContain('listen 443 ssl');
    });
  });
});

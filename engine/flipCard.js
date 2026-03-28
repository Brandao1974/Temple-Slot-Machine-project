class FlipCard {
    constructor(ctx, x, y, frontImage, backImage, options = {}) {
        this.ctx = ctx;
        this.x = x;
        this.y = y;
        this.width = Number(options.width) || 180;
        this.height = Number(options.height) || 250;
        this.frontImage = frontImage;
        this.backImage = backImage;
        this.currentSide = "back";
        this.active = false;
        this.duration = 1000;
        this.startTime = 0;
        this.settleStartTime = 0;
        this.lastUpdateTime = 0;
        this.flipScale = 1;
        this.winUntil = 0;
        this.jackpot = false;
        this.templeEye = false;
        this.highlightPulse = 0;
        this.bounceAmplitude = 0;
    }

    setFrontImage(image) {
        this.frontImage = image;
    }

    setWinning(active, duration = 1400) {
        this.winUntil = active ? Date.now() + duration : 0;
    }

    setJackpot(active) {
        this.jackpot = Boolean(active);
    }

    setTempleEye(active) {
        this.templeEye = Boolean(active);
    }

    resetEffects() {
        this.setWinning(false);
        this.setJackpot(false);
        this.setTempleEye(false);
    }

    start(duration = 1000) {
        this.duration = Math.max(200, Number(duration) || 1000);
        this.startTime = Date.now();
        this.settleStartTime = 0;
        this.lastUpdateTime = this.startTime;
        this.currentSide = "back";
        this.flipScale = 1;
        this.bounceAmplitude = 0.12;
        this.active = true;
    }

    update(now = Date.now()) {
        const delta = Math.max(0, now - this.lastUpdateTime);
        this.lastUpdateTime = now;
        this.highlightPulse += delta * 0.01;

        if (!this.active) {
            return;
        }

        const elapsed = now - this.startTime;
        if (elapsed >= this.duration) {
            this.active = false;
            this.currentSide = "front";
            this.flipScale = 1;
            this.settleStartTime = now;
            return;
        }

        const progress = elapsed / this.duration;
        const totalHalfTurns = 7;
        const angle = Math.PI + (progress * Math.PI * totalHalfTurns);
        const normalizedScale = Math.cos(angle);
        this.currentSide = normalizedScale >= 0 ? "front" : "back";
        this.flipScale = Math.max(0.04, Math.abs(normalizedScale));
    }

    draw(now = Date.now()) {
        const ctx = this.ctx;
        const halfWidth = this.width / 2;
        const halfHeight = this.height / 2;
        const winning = this.winUntil > now;
        const pulse = 0.5 + (Math.sin(this.highlightPulse) * 0.5);
        const bounceElapsed = this.settleStartTime ? now - this.settleStartTime : 9999;
        const bounceFactor = bounceElapsed < 260
            ? Math.sin((bounceElapsed / 260) * Math.PI) * this.bounceAmplitude
            : 0;
        const scaleY = 1 + bounceFactor;
        const shadowStrength = this.jackpot ? 34 : winning ? 24 : 14;
        const glowColor = this.jackpot
            ? `rgba(255, 215, 110, ${0.5 + pulse * 0.35})`
            : this.templeEye
                ? `rgba(101, 214, 255, ${0.28 + pulse * 0.22})`
                : winning
                    ? `rgba(255, 204, 120, ${0.2 + pulse * 0.2})`
                    : "rgba(0, 0, 0, 0.22)";
        const visibleImage = this.currentSide === "front" ? this.frontImage : this.backImage;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.scale(this.flipScale, scaleY);

        ctx.shadowBlur = shadowStrength;
        ctx.shadowColor = glowColor;
        ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
        ctx.fillRect(-halfWidth + 10, -halfHeight + 10, this.width - 20, this.height - 20);

        if (visibleImage && visibleImage.complete) {
            ctx.drawImage(visibleImage, -halfWidth, -halfHeight, this.width, this.height);
        } else {
            ctx.fillStyle = "#33230f";
            ctx.fillRect(-halfWidth, -halfHeight, this.width, this.height);
        }

        if (this.templeEye) {
            ctx.strokeStyle = `rgba(101, 214, 255, ${0.35 + pulse * 0.3})`;
            ctx.lineWidth = 4;
            ctx.strokeRect(-halfWidth + 2, -halfHeight + 2, this.width - 4, this.height - 4);
        }

        if (winning || this.jackpot) {
            const overlay = ctx.createLinearGradient(-halfWidth, 0, halfWidth, 0);
            overlay.addColorStop(0, "rgba(255,255,255,0)");
            overlay.addColorStop(0.5, `rgba(255,235,170,${this.jackpot ? 0.32 : 0.22})`);
            overlay.addColorStop(1, "rgba(255,255,255,0)");
            ctx.fillStyle = overlay;
            ctx.fillRect(-halfWidth, -halfHeight, this.width, this.height);
        }

        ctx.restore();
    }
}

window.FlipCard = FlipCard;

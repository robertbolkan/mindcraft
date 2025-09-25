// Custom plugin to track advancement progress
export function advancementTracker(bot) {
        // Add advancement tracking functionality
        bot.advancementTracker = {
            completed: new Set(),
            progress: new Map(),
            
            // Track when advancements are completed
            onAdvancement: function(advancement) {
                this.completed.add(advancement.id);
                console.log(`Advancement completed: ${advancement.display?.title || advancement.id}`);
            },
            
            // Get advancement progress
            getProgress: function() {
                return {
                    completed: Array.from(this.completed),
                    total: this.completed.size
                };
            },
            
            // Check if advancement is completed
            isCompleted: function(advancementId) {
                return this.completed.has(advancementId);
            }
        };
        
        // Listen for advancement events
        bot.on('advancement', (advancement) => {
            bot.advancementTracker.onAdvancement(advancement);
        });
        
        // Add custom command to check advancements
        bot.on('chat', (username, message) => {
            if (message === '!myadvancements' && username === bot.username) {
                const progress = bot.advancementTracker.getProgress();
                bot.chat(`I've completed ${progress.total} advancements!`);
            }
        });
        
        console.log('Advancement tracker plugin loaded');
}

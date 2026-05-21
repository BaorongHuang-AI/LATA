export class GaleChurchService {

    static align(source, target) {
        const results = [];

        let i = 0, j = 0;

        while (i < source.length && j < target.length) {
            results.push({
                sourceIds: [source[i].id],
                targetIds: [target[j].id],
                confidence: 0.6,
                strategy: "align-gale-church"
            });

            i++;
            j++;
        }

        return results;
    }
}

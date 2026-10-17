import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedProductMinimumStockLevels1792225000000 implements MigrationInterface {
  name = 'SeedProductMinimumStockLevels1792225000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 87 Products with configured Minimum Stock Levels (MSL) from the master product catalog
    const mslUpdates: Record<string, number> = {
      // Page 1 / 17
      'ARG ID 6 TO 15 OD 55- FB': 40,

      // Page 4 / 20
      'EN31 DIA 105 FINE BLANK': 50,
      'EN31 DIA 31 FINE BLANK': 25,
      'EN31 DIA 39 FINE BLANK': 25,
      'EN31 DIA 43 FINE BLANK': 25,
      'EN31 DIA 43 SEMI FINISHED': 25,
      'EN31 DIA 48 FINE BLANK': 25,
      'EN31 DIA 55 FINE BLANK': 50,
      'EN31 DIA 60 FINE BLANK': 50,
      'EN31 DIA 64 FINE BLANK': 25,
      'EN31 DIA 65 FINE BLANK': 50,
      'EN31 DIA 68 FINE BLANK': 25,
      'EN31 DIA 70 FINE BLANK': 50,
      'EN31 DIA 74 FINE BLANK': 25,
      'EN31 DIA 75 FINE BLANK': 50,
      'EN31 DIA 77 FINE BLANK': 25,
      'EN31 DIA 80 FINE BLANK': 50,
      'EN31 DIA 89 FINE BLANK': 25,
      'EN31 DIA 9 FINE BLANK': 25,
      'EN31 DIA 90 FINE BLANK': 50,
      'END CONNECTOR': 20,

      // Page 5 / 21
      'EXTENSTION DIA 10 TO 15 (L=25)': 100,
      'EXTENSTION DIA 10 TO 15 (L=50)': 50,
      'EXTENSTION DIA 15 TO 20 (L=25)': 100,
      'EXTENSTION DIA 15 TO 20 (L=50)': 50,
      'EXTENSTION DIA 20 TO 35 (L=25)': 100,
      'EXTENSTION DIA 20 TO 35 (L=50)': 50,
      'EXTENSTION DIA 35 TO 60 (L=25)': 100,
      'EXTENSTION DIA 35 TO 60 (L=50)': 50,
      'I.S NO:2': 50,
      'I.S NO:3': 50,
      'I.S NO:4 DOUBLE SIDE': 50,
      'I.S NO:5 DOUBLE SIDE': 50,
      'I.S NO:6 DOUBLE SIDE': 50,
      'I.S NO:8 DOUBLE SIDE': 50,
      'I.S NO:8 SINGLE SIDE': 50,
      'I.S NO:9 SINGLE SIDE': 50,
      'I.S NYLON HANDLE': 50,
      'KD 100 FINE BLANK': 100,
      'KD 112 FINE BLANK': 100,
      'KD 125 FINE BLANK': 100,
      'KD 22 WITH HOLE': 50,
      'KD 32 FINE BLANK': 100,
      'KD 38 FINE BLANK': 100,

      // Page 6 / 22
      'KD 45 FINE BLANK': 100,
      'KD 53 CUT PIECE': 50,
      'KD 53 FINE BLANK': 100,
      'KD 63 FINE BLANK': 100,
      'KD 71 FINE BLANK': 100,
      'LONG BAR EN31 DIA 100': 1000,
      'LONG BAR EN31 DIA 105': 1000,
      'LONG BAR EN31 DIA 110': 2000,
      'LONG BAR EN31 DIA 20': 1000,
      'LONG BAR EN31 DIA 30': 1000,
      'LONG BAR EN31 DIA 55': 1000,
      'LONG BAR EN31 DIA 60': 2000,
      'LONG BAR EN31 DIA 65': 1000,
      'LONG BAR EN31 DIA 70': 2000,
      'LONG BAR EN31 DIA 80': 1000,
      'LONG BAR EN31 DIA 85': 2000,
      'LONG BAR OHNS DIA 120': 1000,
      'LONG BAR OHNS DIA 125': 1000,
      'LONG BAR OHNS DIA 130': 1000,

      // Page 7 / 23
      'LONG BAR OHNS DIA 40': 1000,
      'LONG BAR OHNS DIA 65': 1000,
      'LONG BAR OHNS DIA 75': 1000,
      'LONG BAR OHNS DIA 90': 1000,
      'M12 MALE -CJET': 20,
      'M12 MALE 1A': 100,
      'M12 MALE 2A': 50,
      'M14 MALE -CJET': 20,
      'M14 MALE 1A': 100,
      'M14 MALE 2A': 50,
      'M20 MALE -CJET': 20,
      'M20 MALE 1A': 100,
      'M20 MALE 2A': 50,
      'M6 BRASS NIPPLE': 200,
      'M6 FEMALE -CJET': 20,
      'M6 FEMALE 2A': 50,
      'M6 MALE -CJET': 20,
      'M6 MALE 1A': 100,
      'M6 MALE 2A': 50,
      'M6 TAP AND DRILL -CJET': 20,
      'M6 TAP AND DRILL 1A': 100,
      'M8 MALE -CJET': 20,
      'M8 MALE 1A': 100,
      'M8 MALE 2A': 50,
    };

    // Ensure minimum_inventory defaults to 0
    await queryRunner.query(`
      UPDATE "products"
      SET "minimum_inventory" = 0
      WHERE "minimum_inventory" IS NULL;
    `);

    // Update each product with its designated MSL
    for (const [name, msl] of Object.entries(mslUpdates)) {
      await queryRunner.query(
        `UPDATE "products"
         SET "minimum_inventory" = $1, "updated_at" = NOW()
         WHERE UPPER(TRIM("name")) = $2 OR UPPER(TRIM("code")) = $2`,
        [msl, name.toUpperCase()]
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert all to 0
    await queryRunner.query(`
      UPDATE "products"
      SET "minimum_inventory" = 0;
    `);
  }
}

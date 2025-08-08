#!/usr/bin/env node

/**
 * Main migration orchestration script
 * Coordinates the complete SQLite to PostgreSQL migration process
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Import migration modules
const { setupPostgreSQL } = require('./setup-postgresql');
const { exportAllData, validateExport } = require('./export-sqlite-data');
const { importAllData, validateImport } = require('./import-postgresql-data');
const { runFullValidation } = require('./validate-migration');
const { performRollback } = require('./rollback-migration');

/**
 * Migration phases
 */
const PHASES = {
  PREPARATION: 'preparation',
  SETUP: 'setup',
  EXPORT: 'export',
  SCHEMA_UPDATE: 'schema_update',
  IMPORT: 'import',
  VALIDATION: 'validation',
  TESTING: 'testing',
  COMPLETION: 'completion'
};

/**
 * Migration state management
 */
class MigrationState {
  constructor() {
    this.state = {
      startTime: Date.now(),
      currentPhase: null,
      completedPhases: [],
      failedPhases: [],
      errors: [],
      warnings: [],
      rollbackAvailable: false,
      migrationId: this.generateMigrationId()
    };
    this.stateFile = path.join(__dirname, `migration_state_${this.state.migrationId}.json`);
  }
  
  generateMigrationId() {
    return `migration_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  setPhase(phase) {
    this.state.currentPhase = phase;
    this.saveState();
    console.log(`📍 Phase: ${phase.toUpperCase()}`);
  }
  
  completePhase(phase) {
    this.state.completedPhases.push({
      phase,
      completedAt: Date.now()
    });
    this.state.currentPhase = null;
    this.saveState();
    console.log(`✅ Phase completed: ${phase.toUpperCase()}`);
  }
  
  failPhase(phase, error) {
    this.state.failedPhases.push({
      phase,
      failedAt: Date.now(),
      error: error.message
    });
    this.state.errors.push({
      phase,
      timestamp: Date.now(),
      error: error.message
    });
    this.saveState();
    console.error(`❌ Phase failed: ${phase.toUpperCase()} - ${error.message}`);
  }
  
  addWarning(phase, warning) {
    this.state.warnings.push({
      phase,
      timestamp: Date.now(),
      warning
    });
    this.saveState();
    console.warn(`⚠️  Warning in ${phase}: ${warning}`);
  }
  
  saveState() {
    fs.writeFileSync(this.stateFile, JSON.stringify(this.state, null, 2));
  }
  
  loadState(migrationId) {
    const stateFile = path.join(__dirname, `migration_state_${migrationId}.json`);
    if (fs.existsSync(stateFile)) {
      this.state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
      this.stateFile = stateFile;
      return true;
    }
    return false;
  }
}

/**
 * Execute shell command with promise wrapper
 */
function executeCommand(command, args, cwd) {
  return new Promise((resolve, reject) => {
    console.log(`🔧 Executing: ${command} ${args.join(' ')}`);
    
    const process = spawn(command, args, {
      cwd: cwd || path.join(__dirname, '../chat-backend'),
      stdio: 'pipe'
    });
    
    let output = '';
    let errorOutput = '';
    
    process.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      console.log(text.trim());
    });
    
    process.stderr.on('data', (data) => {
      const text = data.toString();
      errorOutput += text;
      console.error(text.trim());
    });
    
    process.on('close', (code) => {
      if (code === 0) {
        resolve({ output, code });
      } else {
        reject(new Error(`Command failed with code ${code}: ${errorOutput}`));
      }
    });
    
    process.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Phase 1: Preparation
 */
async function preparationPhase(state) {
  state.setPhase(PHASES.PREPARATION);
  
  try {
    console.log('🔍 Checking prerequisites...');
    
    // Check if SQLite database exists
    const sqliteDbPath = path.join(__dirname, '../chat-backend/prisma/dev.db');
    if (!fs.existsSync(sqliteDbPath)) {
      throw new Error('SQLite database not found. Please ensure the application has been run at least once.');
    }
    
    // Create backup of SQLite database
    const backupPath = `${sqliteDbPath}.backup`;
    fs.copyFileSync(sqliteDbPath, backupPath);
    console.log(`✅ SQLite database backed up to: ${backupPath}`);
    state.state.rollbackAvailable = true;
    
    // Check if PostgreSQL dependencies are installed
    const packageJsonPath = path.join(__dirname, '../chat-backend/package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    const hasPgDependency = packageJson.dependencies?.pg || packageJson.devDependencies?.pg;
    if (!hasPgDependency) {
      console.log('📦 Installing PostgreSQL dependencies...');
      await executeCommand('npm', ['install', 'pg', '@types/pg']);
      console.log('✅ PostgreSQL dependencies installed');
    }
    
    // Validate environment
    console.log('🔧 Validating environment...');
    const envPath = path.join(__dirname, '../chat-backend/.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      if (!envContent.includes('DATABASE_URL')) {
        state.addWarning(PHASES.PREPARATION, 'DATABASE_URL not found in .env file');
      }
    }
    
    state.completePhase(PHASES.PREPARATION);
    
  } catch (error) {
    state.failPhase(PHASES.PREPARATION, error);
    throw error;
  }
}

/**
 * Phase 2: PostgreSQL Setup
 */
async function setupPhase(state) {
  state.setPhase(PHASES.SETUP);
  
  try {
    console.log('🗄️  Setting up PostgreSQL...');
    const setupSuccess = await setupPostgreSQL();
    
    if (!setupSuccess) {
      throw new Error('PostgreSQL setup failed');
    }
    
    state.completePhase(PHASES.SETUP);
    
  } catch (error) {
    state.failPhase(PHASES.SETUP, error);
    throw error;
  }
}

/**
 * Phase 3: Data Export
 */
async function exportPhase(state) {
  state.setPhase(PHASES.EXPORT);
  
  try {
    console.log('📤 Exporting SQLite data...');
    await exportAllData();
    await validateExport();
    
    state.completePhase(PHASES.EXPORT);
    
  } catch (error) {
    state.failPhase(PHASES.EXPORT, error);
    throw error;
  }
}

/**
 * Phase 4: Schema Update
 */
async function schemaUpdatePhase(state) {
  state.setPhase(PHASES.SCHEMA_UPDATE);
  
  try {
    console.log('🔄 Updating Prisma schema for PostgreSQL...');
    
    // Update .env file FIRST
    const envPath = path.join(__dirname, '../chat-backend/.env');
    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, 'utf8');
      
      // Replace SQLite URL with PostgreSQL URL
      envContent = envContent.replace(
        /DATABASE_URL=["']?file:.*["']?/g,
        'DATABASE_URL="postgresql://postgres:postgres@localhost:5432/chat-app"'
      );
      
      // Add PostgreSQL URL if not exists
      if (!envContent.includes('DATABASE_URL')) {
        envContent += '\nDATABASE_URL="postgresql://postgres:postgres@localhost:5432/chat-app"\n';
      }
      
      fs.writeFileSync(envPath, envContent);
      console.log('✅ Updated .env file for PostgreSQL');
    }
    
    // Update Prisma schema SECOND  
    const schemaPath = path.join(__dirname, '../chat-backend/prisma/schema.prisma');
    if (fs.existsSync(schemaPath)) {
      let schemaContent = fs.readFileSync(schemaPath, 'utf8');
      
      // Replace SQLite provider with PostgreSQL
      schemaContent = schemaContent.replace(
        /provider = ["']?sqlite["']?/g,
        'provider = "postgresql"'
      );
      
      fs.writeFileSync(schemaPath, schemaContent);
      console.log('✅ Updated Prisma schema for PostgreSQL');
    }
    
    // Generate Prisma client THIRD (after config updates)
    console.log('🔧 Generating Prisma client...');
    await executeCommand('npx', ['prisma', 'generate']);
    
    // Push schema to PostgreSQL FOURTH
    console.log('🗄️  Pushing schema to PostgreSQL...');
    await executeCommand('npx', ['prisma', 'db', 'push']);
    
    // Create optimized indexes after schema is created
    console.log('🔧 Creating optimized indexes...');
    const { createOptimizedIndexes } = require('./setup-postgresql');
    await createOptimizedIndexes();
    
    state.completePhase(PHASES.SCHEMA_UPDATE);
    
  } catch (error) {
    state.failPhase(PHASES.SCHEMA_UPDATE, error);
    throw error;
  }
}

/**
 * Phase 5: Data Import
 */
async function importPhase(state) {
  state.setPhase(PHASES.IMPORT);
  
  try {
    console.log('📥 Importing data to PostgreSQL...');
    await importAllData();
    await validateImport();
    
    state.completePhase(PHASES.IMPORT);
    
  } catch (error) {
    state.failPhase(PHASES.IMPORT, error);
    throw error;
  }
}

/**
 * Phase 6: Validation
 */
async function validationPhase(state) {
  state.setPhase(PHASES.VALIDATION);
  
  try {
    console.log('🔍 Validating migration...');
    const validationSuccess = await runFullValidation();
    
    if (!validationSuccess) {
      throw new Error('Migration validation failed');
    }
    
    state.completePhase(PHASES.VALIDATION);
    
  } catch (error) {
    state.failPhase(PHASES.VALIDATION, error);
    throw error;
  }
}

/**
 * Phase 7: Testing
 */
async function testingPhase(state) {
  state.setPhase(PHASES.TESTING);
  
  try {
    console.log('🧪 Running application tests...');
    
    // Run backend tests
    try {
      console.log('🔧 Running backend tests...');
      await executeCommand('npm', ['test']);
      console.log('✅ Backend tests passed');
    } catch (error) {
      state.addWarning(PHASES.TESTING, `Backend tests failed: ${error.message}`);
    }
    
    // Run encryption tests
    try {
      console.log('🔐 Running encryption tests...');
      await executeCommand('npm', ['run', 'test:encryption']);
      console.log('✅ Encryption tests passed');
    } catch (error) {
      state.addWarning(PHASES.TESTING, `Encryption tests failed: ${error.message}`);
    }
    
    state.completePhase(PHASES.TESTING);
    
  } catch (error) {
    state.failPhase(PHASES.TESTING, error);
    // Don't throw error here as test failures shouldn't stop migration
    console.warn('⚠️  Testing phase completed with warnings');
  }
}

/**
 * Phase 8: Completion
 */
async function completionPhase(state) {
  state.setPhase(PHASES.COMPLETION);
  
  try {
    console.log('🎯 Finalizing migration...');
    
    // Generate final migration report
    const migrationReport = {
      migrationId: state.state.migrationId,
      startTime: new Date(state.state.startTime).toISOString(),
      endTime: new Date().toISOString(),
      duration: Date.now() - state.state.startTime,
      completedPhases: state.state.completedPhases,
      failedPhases: state.state.failedPhases,
      warnings: state.state.warnings,
      errors: state.state.errors,
      status: state.state.failedPhases.length > 0 ? 'completed_with_errors' : 'completed_successfully',
      recommendations: []
    };
    
    // Add recommendations based on results
    if (state.state.warnings.length > 0) {
      migrationReport.recommendations.push('Review and address migration warnings');
    }
    if (state.state.failedPhases.length > 0) {
      migrationReport.recommendations.push('Review and fix failed phases');
    }
    migrationReport.recommendations.push('Monitor application performance post-migration');
    migrationReport.recommendations.push('Update deployment scripts to use PostgreSQL');
    migrationReport.recommendations.push('Set up PostgreSQL backup procedures');
    
    // Save final report
    const reportPath = path.join(__dirname, `migration_report_${state.state.migrationId}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(migrationReport, null, 2));
    
    console.log('\n🎉 Migration completed!');
    console.log(`📄 Final report: ${reportPath}`);
    console.log(`⏱️  Total duration: ${migrationReport.duration}ms`);
    
    state.completePhase(PHASES.COMPLETION);
    
    return migrationReport;
    
  } catch (error) {
    state.failPhase(PHASES.COMPLETION, error);
    throw error;
  }
}

/**
 * Main migration orchestrator
 */
async function runMigration(options = {}) {
  const state = new MigrationState();
  
  console.log('🚀 Starting SQLite to PostgreSQL migration...');
  console.log(`🆔 Migration ID: ${state.state.migrationId}\n`);
  
  try {
    // Run migration phases
    await preparationPhase(state);
    
    if (!options.skipSetup) {
      await setupPhase(state);
    }
    
    await exportPhase(state);
    await schemaUpdatePhase(state);
    await importPhase(state);
    await validationPhase(state);
    
    if (!options.skipTesting) {
      await testingPhase(state);
    }
    
    const report = await completionPhase(state);
    
    console.log('\n✅ Migration completed successfully!');
    console.log('\n📋 Next Steps:');
    console.log('  1. Restart your application services');
    console.log('  2. Test application functionality thoroughly');
    console.log('  3. Monitor performance and logs');
    console.log('  4. Update deployment configurations');
    console.log('  5. Set up PostgreSQL backups');
    
    return report;
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    
    if (state.state.rollbackAvailable && !options.noRollback) {
      console.log('\n🔄 Attempting automatic rollback...');
      try {
        await performRollback(`Migration failed: ${error.message}`);
        console.log('✅ Rollback completed successfully');
      } catch (rollbackError) {
        console.error('❌ Rollback also failed:', rollbackError.message);
        console.log('\n🚨 Manual intervention required!');
      }
    }
    
    throw error;
  }
}

/**
 * Resume migration from a specific phase
 */
async function resumeMigration(migrationId, fromPhase) {
  const state = new MigrationState();
  
  if (!state.loadState(migrationId)) {
    throw new Error(`Migration state not found for ID: ${migrationId}`);
  }
  
  console.log(`🔄 Resuming migration ${migrationId} from phase: ${fromPhase}`);
  
  // Resume from specified phase
  const phaseOrder = Object.values(PHASES);
  const startIndex = phaseOrder.indexOf(fromPhase);
  
  if (startIndex === -1) {
    throw new Error(`Invalid phase: ${fromPhase}`);
  }
  
  try {
    for (let i = startIndex; i < phaseOrder.length; i++) {
      const phase = phaseOrder[i];
      
      switch (phase) {
        case PHASES.PREPARATION:
          await preparationPhase(state);
          break;
        case PHASES.SETUP:
          await setupPhase(state);
          break;
        case PHASES.EXPORT:
          await exportPhase(state);
          break;
        case PHASES.SCHEMA_UPDATE:
          await schemaUpdatePhase(state);
          break;
        case PHASES.IMPORT:
          await importPhase(state);
          break;
        case PHASES.VALIDATION:
          await validationPhase(state);
          break;
        case PHASES.TESTING:
          await testingPhase(state);
          break;
        case PHASES.COMPLETION:
          return await completionPhase(state);
      }
    }
  } catch (error) {
    console.error('❌ Migration resume failed:', error.message);
    throw error;
  }
}

// Command line interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];
  
  (async () => {
    try {
      if (command === 'resume') {
        const migrationId = args[1];
        const fromPhase = args[2];
        
        if (!migrationId || !fromPhase) {
          console.error('Usage: node migrate.js resume <migrationId> <fromPhase>');
          process.exit(1);
        }
        
        await resumeMigration(migrationId, fromPhase);
        
      } else {
        const options = {
          skipSetup: args.includes('--skip-setup'),
          skipTesting: args.includes('--skip-testing'),
          noRollback: args.includes('--no-rollback')
        };
        
        await runMigration(options);
      }
      
      process.exit(0);
      
    } catch (error) {
      console.error('Migration process failed:', error.message);
      process.exit(1);
    }
  })();
}

module.exports = { runMigration, resumeMigration, PHASES };
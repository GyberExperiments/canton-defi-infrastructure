// Canton Console Script: Connect Participant to DevNet Global Synchronizer
// This script registers and connects the participant to Canton Network's DevNet global domain
//
// Usage: Run this script in Canton console:
//   participant.scripts.run("/path/to/connect-synchronizer.sc")

import com.digitalasset.canton.config._
import com.digitalasset.canton.sequencing._

// Global synchronizer configuration for DevNet
val synchronizerAlias = "global"
val sequencerUrl = "https://sequencer-1.sv-1.dev.global.canton.network.sync.global:443"

println("=" * 70)
println(" Canton Participant - DevNet Global Synchronizer Connection")
println("=" * 70)
println()

// Check if already registered
val registered = participant.domains.list_registered()
val alreadyRegistered = registered.exists(_.config.domain == synchronizerAlias)

if (!alreadyRegistered) {
  println(s"⚙️  Registering synchronizer: $synchronizerAlias")
  println(s"📡 Sequencer URL: $sequencerUrl")
  println()

  // Create domain connection configuration
  val config = DomainConnectionConfig(
    domain = synchronizerAlias,
    sequencerConnections = SequencerConnections.single(
      GrpcSequencerConnection.create(
        sequencerUrl,
        transportSecurity = true
      )
    ),
    manualConnect = false  // Auto-connect after registration
  )

  // Register the domain
  participant.domains.register(config)

  println("✅ Synchronizer registered")
  println()
  println("⏳ Waiting for connection to establish...")
  Thread.sleep(10000)  // Wait 10 seconds for connection

  // Verify connection
  val connected = participant.domains.list_connected()
  if (connected.exists(_.domainAlias == synchronizerAlias)) {
    println()
    println("=" * 70)
    println("  ✅ SUCCESS: Connected to Canton Network DevNet Global Synchronizer")
    println("=" * 70)
    println()
    println("Connection Details:")
    println(s"  - Synchronizer Alias: $synchronizerAlias")
    println(s"  - Sequencer URL: $sequencerUrl")
    println(s"  - Status: Connected")
    println()
    println("Next steps:")
    println("  1. Allocate parties for your application")
    println("  2. Deploy DAML models")
    println("  3. Create contracts via Ledger API")
    println()
  } else {
    println()
    println("⚠️  WARNING: Registration succeeded but connection not yet established")
    println("   Check participant logs for connection status")
    println()
    println("Troubleshooting:")
    println("  1. Verify network connectivity to sequencer")
    println("  2. Check participant logs: kubectl -n validator logs participant-xxx")
    println("  3. Retry connection: participant.domains.reconnect(\"$synchronizerAlias\")")
    println()
  }
} else {
  println(s"ℹ️  Synchronizer '$synchronizerAlias' already registered")
  println()

  // Check if connected
  val connected = participant.domains.list_connected()
  if (!connected.exists(_.domainAlias == synchronizerAlias)) {
    println("⚙️  Not connected. Attempting to reconnect...")
    participant.domains.reconnect(synchronizerAlias)
    Thread.sleep(10000)

    val reconnected = participant.domains.list_connected()
    if (reconnected.exists(_.domainAlias == synchronizerAlias)) {
      println("✅ Successfully reconnected to synchronizer")
    } else {
      println("❌ Failed to reconnect. Check participant logs.")
    }
  } else {
    println("✅ Already connected to synchronizer")
  }
  println()
}

// Display current synchronizer status
println()
println("Current Synchronizer Configuration:")
println("-" * 70)
println()
participant.domains.list_registered().foreach { domain =>
  println(s"Domain: ${domain.config.domain}")
  println(s"  Sequencers: ${domain.config.sequencerConnections}")
  println(s"  Manual Connect: ${domain.config.manualConnect}")
  println()
}

println()
println("Connected Synchronizers:")
println("-" * 70)
println()
val connectedDomains = participant.domains.list_connected()
if (connectedDomains.isEmpty) {
  println("  (none)")
} else {
  connectedDomains.foreach { domain =>
    println(s"✓ ${domain.domainAlias}")
    println(s"  Domain ID: ${domain.domainId}")
    println()
  }
}

println("=" * 70)

"use strict";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
// import { ShareCount } from "../models/wallet.model.js";
// import { Wallet } from "../models/wallet.model.js";
import { Paymentdetail } from "../models/wallet.model.js";
import { WalletTransaction } from "../models/wallet.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import axios from "axios";

const depositAmount = asyncHandler(async (req, res) => {
  try {
    const { deposit_amount: depositAmount } = req.body;
    const userId = req?.user?.userId || null;

    if (!depositAmount || !userId) {
      throw new ApiError(400, "Deposit Amount Amount or user id not found");
    }

    const lastTransaction = await WalletTransaction.findOne({ userId }).sort({
      _id: -1,
    });

    if (lastTransaction) {
      const transaction = new WalletTransaction({
        userId: userId,
        transactionId: `${Math.floor(Math.random() * 100000)}${Date.now()}`,
        credit: depositAmount,
        balance: lastTransaction
          ? lastTransaction.balance + depositAmount
          : depositAmount,
        transactionType: "Credit Amount",
        reference: `self`,
        referenceId: userId,
      });
      await transaction.save();
    } else {
      const transaction = await WalletTransaction.create({
        userId: userId,
        transactionId: `${Math.floor(Math.random() * 100000)}${Date.now()}`,
        credit: depositAmount,
        balance: lastTransaction
          ? lastTransaction.balance + depositAmount
          : depositAmount,
        transactionType: "Credit Amount",
        reference: `self`,
        referenceId: userId,
      });
    }

    const walletDetails = await WalletTransaction.findOne({ userId }).sort({
      _id: -1,
    });

    return res
      .status(200)
      .json(
        new ApiResponse(200, walletDetails, "Amount is added successfully")
      );
  } catch (error) {
    throw new ApiError(400, error);
  }
});

const generateQr = asyncHandler(async (req, res) => {
  const { currencyName, email, amount, mobileNo, blockchain, userId } =
    req.body;

  // Validate required fields
  if (!currencyName || !email || !amount || !mobileNo || !blockchain) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    const response = await axios.post(
      "https://api.oxapay.com/merchants/request/whitelabel",
      {
        merchant: "NCV36N-GTMR3L-6XHTHD-62W176",
        currency: currencyName,
        payCurrency: currencyName,
        amount: amount,
        email: email,
        description: mobileNo,
        network: blockchain,
      }
    );

    if (response.data.result === 100) {
      const trackId = response.data.trackId;
      const address = response.data.address; // Get the address from the response
      // Generate QR code URL
      console.log("trackId", trackId);
      console.log("address", address);
      // Create and save payment request in the database
      const paymentRequest = new Paymentdetail({
        trackId,
        userId,
        amount,
        currency: currencyName,
        status: "Waiting", // Default status
        expiredAt: Date.now() + 60 * 1000,
        email,
        description: mobileNo,
        address,
      });
      console.log("paymentRequest", paymentRequest);

      await paymentRequest.save();

      // Pass userId to handleRequestMoney
      await handleRequestMoneyTest(req, res, { trackId, userId });

      // Respond with the generated QR code URL

      res
        .status(200)
        .json(
          new ApiResponse(200, response.data, "Payment request successful")
        );
    } else {
      throw new ApiError(400, `API Error: ${response.data.message}`);
    }
  } catch (error) {
    console.error("API Error:", error);
    throw new ApiError(500, "Something went wrong with the payment request");
  }
});

const handleRequestMoneyTest = asyncHandler(async (req, res, trackId) => {
  try {
    console.log("Track ID handleRequestMoneyTest:", trackId);

    if (!trackId) {
      return res.status(400).json({ message: "trackId is required" });
    }

    let responseSent = false; // Flag to track if a response has been sent

    const checkPaymentStatus = async () => {
      try {
        // Make API call to check payment status
        const response = await axios.post(
          "https://api.oxapay.com/merchants/inquiry",
          {
            merchant: "NCV36N-GTMR3L-6XHTHD-62W176",
            trackId: trackId.trackId,
          }
        );

        // Handle payment status based on response
        if (response.data.status === "Paid") {
          if (!responseSent) {
            const depositAmount = response.data.receivedAmount; // Get the deposit amount from the response
            const userId = trackId.userId; // Extract userId from trackId

            // Call the addDepositAmountAdmin function
            await addDepositAmountUser(
              { body: { deposit_amount: depositAmount }, query: { userId } },
              res
            );
            responseSent = true; // Mark response as sent
          }
        } else if (response.data.status === "Waiting") {
          // Log the trackId and userId during the waiting state
          console.log(
            `Waiting for payment confirmation... Track ID: ${trackId.trackId}, User ID: ${trackId.userId}`
          );

          // Re-run check after a delay if response hasn't been sent
          if (!responseSent) {
            setTimeout(checkPaymentStatus, 120000); // Retry after 2 minutes
          }
        } else if (response.data.status === "Expired") {
          if (!responseSent) {
            return res.status(400).json({
              message: "Transaction has expired.",
              status: "Expired",
            });
          }
        } else {
          if (!responseSent) {
            return res.status(400).json({
              message: "Transaction is still pending.",
              status: response.data.status,
            });
          }
        }
      } catch (error) {
        console.error(
          "API Error while checking payment status:",
          error.message
        );
        if (!responseSent) {
          return res.status(500).json({
            message: "Error occurred while checking payment status",
            error: error.message,
          });
        }
      }
    };

    // Start checking the payment status
    checkPaymentStatus();
  } catch (error) {
    console.error("API Error:", error.message);
    return res.status(500).json({
      message: error.message,
      error: error,
    });
  }
});

const generateTransactionId = () => {
  return `txn_${Date.now()}_${Math.floor(Math.random() * 1000)}`; // Create a unique transaction ID
};

const addDepositAmountAdmin = asyncHandler(async (req, res) => {
  try {
    const { deposit_amount: depositAmount } = req.body;
    const userId = req.query.userId;

    // Get the sharedId of the user
    const user = await User.findOne({ userId }).select("sharedId");
    const shareId = user?.sharedId;

    // Validate deposit amount and user ID
    if (!depositAmount || !userId) {
      throw new ApiError(400, "Missing deposit amount or user ID");
    }

    // Fetch previous transactions for the user, excluding zero-credit/debit transactions
    const transactions = await WalletTransaction.find({
      userId,
      $or: [{ credit: { $ne: 0 } }, { debit: { $ne: 0 } }],
    })
      .sort({ createdAt: -1 })
      .select("-__v");

    // Calculate the current balance
    const balance = transactions.length > 0 ? transactions[0].balance : 0;
    const newBalance = balance + parseInt(depositAmount);

    // Create a new transaction for the deposit
    const transaction = new WalletTransaction({
      userId,
      transactionId: generateTransactionId(),
      credit: parseInt(depositAmount),
      balance: newBalance,
      transactionType: "Deposit",
      reference: "Admin Deposit",
      referenceId: userId,
    });

    await transaction.save();

    // Check if this is the first non-zero deposit and amount is greater than 100
    if (transactions.length === 0 && depositAmount > 100) {
      const bonus = depositAmount * 0.05; // 5% bonus

      // Add bonus for the user
      await WalletTransaction.create({
        userId,
        transactionId: generateTransactionId(),
        credit: bonus,
        balance: newBalance + bonus,
        transactionType: "Bonus",
        reference: "First Time Deposit Bonus",
        referenceId: userId,
      });

      // If shareId exists, add a bonus for the referred user (Level 1)
      if (shareId) {
        // Fetch Level 1 user's last transaction to get their balance
        const level1Transactions = await WalletTransaction.find({
          userId: shareId,
          $or: [{ credit: { $ne: 0 } }, { debit: { $ne: 0 } }],
        })
          .sort({ createdAt: -1 })
          .select("-__v");
        const level1Balance =
          level1Transactions.length > 0 ? level1Transactions[0].balance : 0;

        const level1Bonus = depositAmount * 0.05; // 5% bonus for Level 1 user

        await WalletTransaction.create({
          userId: shareId,
          transactionId: generateTransactionId(),
          credit: level1Bonus,
          balance: level1Balance + level1Bonus,
          transactionType: "Level 1 Bonus",
          reference: "Level 1 User Bonus",
          referenceId: userId,
        });
      }
    }

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { balance: newBalance },
          "Amount is added successfully"
        )
      );
  } catch (error) {
    console.error("Error:", error.message);
    throw new ApiError(400, error.message || "Something went wrong");
  }
});

// Get wallet balance and transactions

const getWalletBalanceUser = asyncHandler(async (req, res) => {
  try {
    const userId = req.query.userId; // Get user ID from query parameters

    if (!userId) {
      throw new ApiError(400, "User ID is required");
    }

    // Fetch the wallet amount
    // const wallet = await Wallet.findOne({ userId }).select("walletAmount");

    // Fetch all transactions for the user
    const transactions = await WalletTransaction.find({ userId })
      .sort({ createdAt: -1 }) // Sort by createdAt to get the latest transactions first
      .select("-__v"); // Exclude the __v field

    // If there are no transactions, the balance will be the wallet amount
    const balance =
      transactions.length > 0
        ? transactions[0].balance // Last transaction's balance
        : wallet
        ? wallet.walletAmount
        : 0;

    return res.status(200).json({
      statusCode: 200,
      data: {
        balance, // Last transaction's balance or wallet amount
        // walletAmount: wallet ? wallet.walletAmount : 0, // Include wallet amount if needed
        transactions: transactions || [], // Include all transaction details
      },
      message: "Wallet balance and transactions fetched successfully",
      success: true,
    });
  } catch (error) {
    throw new ApiError(400, error.message || "Something went wrong");
  }
});

const getAllWalletTransactions = asyncHandler(async (req, res) => {
  try {
    // Fetch all wallet transactions
    const transactions = await WalletTransaction.find().sort({ createdAt: -1 });

    // Check if there are no transactions found
    if (!transactions || transactions.length === 0) {
      return res
        .status(200)
        .json(new ApiResponse(200, [], "No transactions found"));
    }

    // Fetch all user IDs from the transactions
    const userIds = transactions.map((transaction) => transaction.userId);

    // Fetch user details for all users involved in the transactions
    const users = await User.find({ userId: { $in: userIds } }).select(
      "userId username email mobileNo"
    );

    const userMap = users.reduce((acc, user) => {
      acc[user.userId] = user; // Store user details with userId as key
      return acc;
    }, {});
    console.log("userMap", userMap);

    // Map through transactions to include user details

    const structuredTransactions = transactions.map((transaction) => ({
      _id: transaction._id,
      userId: transaction.userId,
      username: userMap[transaction.userId]?.username || null, // Get populated username
      email: userMap[transaction.userId]?.email || null, // Get populated email
      mobileNo: userMap[transaction.userId]?.mobileNo || null, // Get populated mobile number
      transactionId: transaction.transactionId,
      credit: transaction.credit,
      debit: transaction.debit,
      balance: transaction.balance,
      transactionType: transaction.transactionType,
      reference: transaction.reference,
      referenceId: transaction.referenceId,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
    }));

    // console.log("structuredTransactions", structuredTransactions);

    // Return success response with structured transactions
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          structuredTransactions,
          "Wallet transactions fetched successfully"
        )
      );
  } catch (error) {
    console.error("Error fetching wallet transactions:", error.message);
    throw new ApiError(400, error.message || "Something went wrong");
  }
});

const allPaymentRequestOfUser = asyncHandler(async (req, res) => {
  const userId = req.query.userId;

  if (!userId) {
    return res.status(400).json({ message: "User ID is required" });
  }

  try {
    // Fetch all payment requests for the user without limiting fields
    const paymentRequests = await WalletTransaction.find({ userId }).sort({
      createdAt: -1,
    });

    if (paymentRequests.length === 0) {
      return res
        .status(404)
        .json({ message: "No payment requests found for this user" });
    }

    return res.status(200).json({
      statusCode: 200,
      data: paymentRequests,
      message: "Payment requests retrieved successfully",
      success: true,
    });
  } catch (error) {
    console.error("Error fetching payment requests:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

const addDepositAmountUser = asyncHandler(async (req, res) => {
  try {
    const { deposit_amount: depositAmount } = req.body;
    const userId = req.query.userId;

    // Get the sharedId of the user
    const user = await User.findOne({ userId }).select("sharedId");
    const shareId = user?.sharedId;

    // Validate deposit amount and user ID
    if (!depositAmount || !userId) {
      throw new ApiError(400, "Missing deposit amount or user ID");
    }

    // Fetch previous transactions for the user, excluding zero-credit/debit transactions
    const transactions = await WalletTransaction.find({
      userId,
      $or: [{ credit: { $ne: 0 } }, { debit: { $ne: 0 } }],
    })
      .sort({ createdAt: -1 })
      .select("-__v");

    // Calculate the current balance
    const balance = transactions.length > 0 ? transactions[0].balance : 0;
    const newBalance = balance + parseInt(depositAmount);

    // Create a new transaction for the deposit
    const transaction = new WalletTransaction({
      userId,
      transactionId: generateTransactionId(),
      credit: parseInt(depositAmount),
      balance: newBalance,
      transactionType: "Deposit",
      reference: "Admin Deposit",
      referenceId: userId,
    });

    await transaction.save();

    // Check if this is the first non-zero deposit and amount is greater than 100
    if (transactions.length === 0 && depositAmount >= 100) {
      const bonus = depositAmount * 0.05; // 5% bonus

      // Add bonus for the user
      await WalletTransaction.create({
        userId,
        transactionId: generateTransactionId(),
        credit: bonus,
        balance: newBalance + bonus,
        transactionType: "Bonus",
        reference: "First Time Deposit Bonus",
        referenceId: userId,
      });

      // If shareId exists, add a bonus for the referred user (Level 1)
      if (shareId) {
        // Fetch Level 1 user's last transaction to get their balance
        const level1Transactions = await WalletTransaction.find({
          userId: shareId,
          $or: [{ credit: { $ne: 0 } }, { debit: { $ne: 0 } }],
        })
          .sort({ createdAt: -1 })
          .select("-__v");
        const level1Balance =
          level1Transactions.length > 0 ? level1Transactions[0].balance : 0;

        const level1Bonus = depositAmount * 0.05; // 5% bonus for Level 1 user

        await WalletTransaction.create({
          userId: shareId,
          transactionId: generateTransactionId(),
          credit: level1Bonus,
          balance: level1Balance + level1Bonus,
          transactionType: "Level 1 Bonus",
          reference: "Level 1 User Bonus",
          referenceId: userId,
        });
      }
    }

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { balance: newBalance },
          "Amount is added successfully"
        )
      );
  } catch (error) {
    console.error("Error:", error.message);
    throw new ApiError(400, error.message || "Something went wrong");
  }
});
export {
  depositAmount,
  //   handleRequestMoney,
  generateQr,
  addDepositAmountAdmin,
  getWalletBalanceUser,
  //   getUserRecordsWithTransactions,
  getAllWalletTransactions,
  handleRequestMoneyTest,
  allPaymentRequestOfUser,
};

// const addDepositAmountUser = asyncHandler(async (req, res) => {
//   try {
//     const { deposit_amount: depositAmount } = req.body;
//     // const userId = req.query.userId;
//     const userId = req.user.userId || req.query.user_id;

//     console.log("Deposit Amount:", depositAmount); // Log for debugging
//     console.log("User ID:", userId); // Log for debugging

//     if (!depositAmount || !userId) {
//       throw new ApiError(
//         400,
//         "Something went wrong: Missing deposit amount or user ID"
//       );
//     }
// 	// Find the last transaction to get the latest balance
//     const lastTransaction = await WalletTransaction.findOne({ userId }).sort({
//       createdAt: -1,
//     });

//     // Calculate the new balance
//     const newBalance =
//       (lastTransaction?.balance || 0) + parseInt(depositAmount);

//     // Create a new transaction with a unique transaction ID
//     const transaction = new WalletTransaction({
//       userId,
//       transactionId: generateTransactionId(), // Generate a unique transaction ID
//       credit: parseInt(depositAmount), // Set credit amount
//       balance: newBalance, // Set the balance after the transaction
//       transactionType: "Deposit",
//       reference: "User Deposit", // Can be customized as needed
//       referenceId: userId,
//     });

//     await transaction.save(); // Save the transaction

//     return res
//       .status(200)
//       .json(new ApiResponse(200, transaction, "Amount is added successfully"));
//   } catch (error) {
//     console.error("Error:", error.message); // Log the error message
//     throw new ApiError(400, error.message || "Something went wrong");
//   }
// });

// const addDepositAmountAdmin = asyncHandler(async (req, res) => {
//   try {
//     const { deposit_amount: depositAmount } = req.body;
//     const userId = req.query.userId; // Accessing userId from query parameters
// 	const shareId = await User.findOne({ userId: userId }).select('sharedId');	// Get the sharedId
//     // let level1 = await User.findOne({ userId: sharedId }); // Find Level 1 user

//     console.log("Deposit Amount:", depositAmount); // Log for debugging
//     console.log("User ID:", userId); // Log for debugging

//     if (!depositAmount || !userId) {
//       throw new ApiError(
//         400,
//         "Something went wrong: Missing deposit amount or user ID"
//       );
//     }

//     // Fetch the user's previous transactions
//     const transactions = await WalletTransaction.find({ userId })
//       .sort({ createdAt: -1 }) // Sort by the latest transaction
//       .select("-__v"); // Exclude the __v field

//     // Determine the balance
//     const balance = transactions.length > 0 ? transactions[0].balance  : 0; // Default to 0 if no transactions

//     // Calculate the new balance
//     const newBalance = balance + parseInt(depositAmount);

//     // Create a new transaction with a unique transaction ID
//     const transaction = new WalletTransaction({
//       userId,
//       transactionId: generateTransactionId(), // Generate a unique transaction ID
//       credit: parseInt(depositAmount), // Set credit amount
//       balance: newBalance, // Set the new balance after the transaction
//       transactionType: "Deposit",
//       reference: "Admin Deposit", // Can be customized as needed
//       referenceId: userId,
//     });

//     await transaction.save(); // Save the transaction

//     // Check if this is the first deposit and amount is greater than 100
//     if (transactions.length === 0 && depositAmount > 100) {
//       const bonus = depositAmount * 0.05; // Calculate 5% bonus
//       // Update the user's balance with the bonus
//       await WalletTransaction.create({
//         userId,
//         transactionId: generateTransactionId(),
//         credit: bonus,
//         balance: newBalance + bonus, // New balance with bonus
//         transactionType: "Bonus",
//         reference: "First Time Deposit Bonus",
//         referenceId: userId,
//       });

//       // If Level 1 user exists, give them a bonus as well
//       if (level1) {
//         const level1Bonus = depositAmount * 0.05; // Calculate 5% bonus for Level 1 user
//         await WalletTransaction.create({
//           userId: level1.userId, // Use Level 1 user's ID
//           transactionId: generateTransactionId(),
//           credit: level1Bonus,
//           balance: level1.balance + level1Bonus, // Update their balance with the bonus
//           transactionType: "Level 1 Bonus",
//           reference: "Level 1 User Bonus",
//           referenceId: userId,
//         });
//       }
//     }

//     return res
//       .status(200)
//       .json(
//         new ApiResponse(
//           200,
//           { balance: newBalance },
//           "Amount is added successfully"
//         )
//       );
//   } catch (error) {
//     console.error("Error:", error.message); // Log the error message
//     throw new ApiError(400, error.message || "Something went wrong");
//   }
// });

// const addDepositAmountAdmin = asyncHandler(async (req, res) => {
//   try {
//     const { deposit_amount: depositAmount } = req.body;
//     const userId = req.query.userId; // Accessing userId from query parameters

//     console.log("Deposit Amount:", depositAmount); // Log for debugging
//     console.log("User ID:", userId); // Log for debugging

//     if (!depositAmount || !userId) {
//       throw new ApiError(
//         400,
//         "Something went wrong: Missing deposit amount or user ID"
//       );
//     }

//     // Fetch the user's previous transactions
//     const transactions = await WalletTransaction.find({ userId })
//       .sort({ createdAt: -1 }) // Sort by the latest transaction
//       .select("-__v"); // Exclude the __v field

//     // Determine the balance
//     const balance =
//       transactions.length > 0
//         ? transactions[0].balance // Last transaction's balance
//         : 0; // Default to 0 if no transactions

//     // Calculate the new balance
//     const newBalance = balance + parseInt(depositAmount);

//     // Create a new transaction with a unique transaction ID
//     const transaction = new WalletTransaction({
//       userId,
//       transactionId: generateTransactionId(), // Generate a unique transaction ID
//       credit: parseInt(depositAmount), // Set credit amount
//       balance: newBalance, // Set the new balance after the transaction
//       transactionType: "Deposit",
//       reference: "Admin Deposit", // Can be customized as needed
//       referenceId: userId,
//     });

//     await transaction.save(); // Save the transaction

//     return res
//       .status(200)
//       .json(
//         new ApiResponse(
//           200,
//           { balance: newBalance },
//           "Amount is added successfully"
//         )
//       );
//   } catch (error) {
//     console.error("Error:", error.message); // Log the error message
//     throw new ApiError(400, error.message || "Something went wrong");
//   }
// });

// const allPaymentRequestOfUser = asyncHandler(async (req, res) => {
//   const userId = req.query.userId; // Get user ID from query parameters

//   // Validate user ID
//   if (!userId) {
//     return res.status(400).json({ message: "User ID is required" });
//   }

//   try {
//     // Fetch payment requests associated with the user ID
//     const paymentRequests = await WalletTransaction.find({ userId })
//       .select(
//         "trackId amount currency status expiredAt createdAt email description address" // Include address here
//       )
//       .sort({ createdAt: -1 }); // Sort by createdAt in descending order

//     // Check if there are no payment requests
//     if (paymentRequests.length === 0) {
//       return res
//         .status(404)
//         .json({ message: "No payment requests found for this user" });
//     }

//     return res.status(200).json({
//       statusCode: 200,
//       data: paymentRequests,
//       message: "Payment requests retrieved successfully",
//       success: true,
//     });
//   } catch (error) {
//     console.error("Error fetching payment requests:", error);
//     return res.status(500).json({ message: "Internal server error" });
//   }
// });

// const addDepositAmountAdmin = asyncHandler(async (req, res) => {
//   try {
//     const { deposit_amount: depositAmount } = req.body;
//     const userId = req.query.userId; // Accessing userId from query parameters

//     console.log("Deposit Amount:", depositAmount); // Log for debugging
//     console.log("User ID:", userId); // Log for debugging

//     if (!depositAmount || !userId) {
//       throw new ApiError(
//         400,
//         "Something went wrong: Missing deposit amount or user ID"
//       );
//     }

//     // Update the wallet amount by creating or updating the wallet entry
//     // const walletResponse = await Wallet.findOneAndUpdate(
//     // 	{ userId }, // Find wallet by userId
//     // 	{ $inc: { walletAmount: parseInt(depositAmount) } },
//     // 	{ new: true, upsert: true }
//     // );

//     if (!walletResponse) {
//       throw new ApiError(
//         400,
//         "Something went wrong while adding amount to wallet"
//       );
//     }

//     // Create a new transaction with a unique transaction ID
//     const transaction = new WalletTransaction({
//       userId,
//       transactionId: generateTransactionId(), // Generate a unique transaction ID
//       credit: parseInt(depositAmount), // Set credit amount
//       balance: walletResponse.walletAmount, // Set the balance after the transaction
//       transactionType: "Deposit",
//       reference: "Admin Deposit", // Can be customized as needed
//       referenceId: userId,
//     });

//     await transaction.save(); // Save the transaction

//     // const walletDetails = await Wallet.findById(walletResponse._id).select();

//     return res
//       .status(200)
//       .json(
//         new ApiResponse(200, walletDetails, "Amount is added successfully")
//       );
//   } catch (error) {
//     console.error("Error:", error.message); // Log the error message
//     throw new ApiError(400, error.message || "Something went wrong");
//   }
// });

// const addDepositAmountUser = asyncHandler(async (req, res) => {
//   try {
//     const { deposit_amount: depositAmount } = req.body;
//     const userId = req.query.userId; // Accessing userId from query parameters

//     console.log("Deposit Amount:", depositAmount); // Log for debugging
//     console.log("User ID:", userId); // Log for debugging

//     if (!depositAmount || !userId) {
//       throw new ApiError(
//         400,
//         "Something went wrong: Missing deposit amount or user ID"
//       );
//     }

//     // Update the wallet amount by creating or updating the wallet entry
//     const walletResponse = await Wallet.findOneAndUpdate(
//       { userId }, // Find wallet by userId
//       { $inc: { walletAmount: parseInt(depositAmount) } }, // Increment wallet amount
//       { new: true, upsert: true } // Create if it doesn't exist
//     );

//     if (!walletResponse) {
//       throw new ApiError(
//         400,
//         "Something went wrong while adding amount to wallet"
//       );
//     }

//     // Create a new transaction with a unique transaction ID
//     const transaction = new WalletTransaction({
//       userId,
//       transactionId: generateTransactionId(), // Generate a unique transaction ID
//       credit: parseInt(depositAmount), // Set credit amount
//       balance: walletResponse.walletAmount, // Set the balance after the transaction
//       transactionType: "Deposit",
//       reference: "User Deposit", // Can be customized as needed
//       referenceId: userId,
//     });

//     await transaction.save(); // Save the transaction

//     const walletDetails = await Wallet.findById(walletResponse._id).select();

//     return res
//       .status(200)
//       .json(
//         new ApiResponse(200, walletDetails, "Amount is added successfully")
//       );
//   } catch (error) {
//     console.error("Error:", error.message); // Log the error message
//     throw new ApiError(400, error.message || "Something went wrong");
//   }
// });

// const handleRequestMoneyTest = asyncHandler(
//   async (req, res, trackId, userId) => {
//     try {
//       console.log("Track ID handleRequestMoneyTest:", trackId);
//       console.log("User ID:", userId);

//       if (!trackId) {
//         return res.status(400).json({ message: "trackId is required" });
//       }

//       const checkPaymentStatus = async () => {
//         try {
//           // Make API call to check payment status
//           const response = await axios.post(
//             "https://api.oxapay.com/merchants/inquiry",
//             {
//               merchant: "NCV36N-GTMR3L-6XHTHD-62W176",
//               trackId: trackId.trackId,
//             }
//           );

//           // Handle payment status based on response
//           if (response.data.status === "Paid") {
//             return res.status(200).json({
//               message: "Transaction is successful.",
//               status: "Paid",
//               amount: response.data.payAmount,
//               transactionDetails: response.data,
//             });
//           } else if (response.data.status === "Waiting") {
//             // Log the trackId and userId during the waiting state
//             console.log(
//               `Waiting for payment confirmation... Track ID: ${trackId.trackId}, User ID: ${trackId.userId}`
//             );

//             // Re-run check after a delay
//             setTimeout(checkPaymentStatus, 120000); // Retry after 5 seconds
//           } else if (response.data.status === "Expired") {
//             return res.status(400).json({
//               message: "Transaction has expired.",
//               status: "Expired",
//             });
//           } else {
//             return res.status(400).json({
//               message: "Transaction is still pending.",
//               status: response.data.status,
//             });
//           }
//         } catch (error) {
//           console.error(
//             "API Error while checking payment status:",
//             error.message
//           );
//           return res.status(500).json({
//             message: "Error occurred while checking payment status",
//             error: error.message,
//           });
//         }
//       };

//       // Start checking the payment status
//       checkPaymentStatus();
//     } catch (error) {
//       console.error("API Error:", error.message);
//       return res.status(500).json({
//         message: error.message,
//         error: error,
//       });
//     }
//   }
// );

// const handleRequestMoney = asyncHandler(async (req, res, trackId, userId) => {
//   try {
//     // const trackId = trackId || req.body.trackId || null;

//     console.log("Track ID:", trackId);
//     // console.log("User ID:", userId);

//     if (!trackId) {
//       return res.status(400).json({ message: "trackId is required" });
//     }

//     // console.log("userId:", userId); // \
//     const response = await axios.post(
//       "https://api.oxapay.com/merchants/inquiry",
//       {
//         merchant: "NCV36N-GTMR3L-6XHTHD-62W176",
//         trackId: trackId,
//       }
//     );

//     if (response.data.status === "Paid") {
//       return res.status(200).json({
//         message: "Transaction is successful.",
//         status: "Paid",
//         amount: response.data.payAmount,
//         transactionDetils: response,
//       });
//     } else if (response.data.status === "Waiting") {
//       //   handleRequestMoney(req, res, trackId);
//       console.log("waitin ...   .. g");
//     }
//   } catch (error) {
//     console.error("API Error:", error.message);
//     return res.status(500).json({
//       message: error.message,
//       error: error,
//     });
//   }
// });

// const generateQr = asyncHandler(async (req, res) => {
//   const { currencyName, email, amount, mobileNo, blockchain, userId } =
//     req.body;

//   //   const userId = global?.logged_in_user?.userId || null; // Retrieve userId
//   console.log("userId generateQr", userId);
//   // Validate required fields
//   if (!currencyName) {
//     throw new ApiError(
//       400,
//       "currencyName is required (currencyName and blockchain)"
//     );
//   }
//   if (!email) {
//     throw new ApiError(400, "Email is required");
//   }
//   if (!amount) {
//     throw new ApiError(400, "Amount is required");
//   }
//   if (!mobileNo) {
//     throw new ApiError(400, "Phone is required");
//   }
//   if (!blockchain) {
//     throw new ApiError(400, "Blockchain is required");
//   }

//   try {
//     const response = await axios.post(
//       "https://api.oxapay.com/merchants/request/whitelabel",
//       {
//         merchant: "NCV36N-GTMR3L-6XHTHD-62W176",
//         currency: currencyName,
//         payCurrency: currencyName,
//         amount: amount,
//         email: email,
//         description: mobileNo,
//         network: blockchain,
//       }
//     );

//     if (response.data.result === 100) {
//       const trackId = response.data.trackId;
//       // Pass userId to handleRequestMoney
//       console.log("trackId generated: ", trackId);
//       console.log("userId generated: ", userId);
//       await handleRequestMoney(req, res, {trackId, userId});

//       res
//         .status(200)
//         .json(
//           new ApiResponse(200, response.data, "Payment request successful")
//         );
//     } else {
//       throw new ApiError(400, `API Error: ${response.data.message}`);
//     }
//   } catch (error) {
//     console.error("API Error:", error);
//     throw new ApiError(500, "Something went wrong with the payment request");
//   }
// });

// const getWalletBalanceUser = asyncHandler(async (req, res) => {
//   try {
//     const userId = req.query.userId; // Get user ID from query parameters

//     if (!userId) {
//       throw new ApiError(400, "User ID is required");
//     }

//     // Fetch wallet details (if needed)
//     const wallet = await Wallet.findOne({ userId }).select("walletAmount");

//     // Fetch all transactions for the user
//     const transactions = await WalletTransaction.find({ userId }).sort({
//       createdAt: -1,
//     });

//     // Calculate the total balance (if required)
//     const totalBalance = wallet ? wallet.walletAmount : 0;

//     return res.status(200).json(
//       new ApiResponse(
//         200,
//         {
//           balance: totalBalance,
//           transactions,
//         },
//         "Wallet balance and transactions fetched successfully"
//       )
//     );
//   } catch (error) {
//     throw new ApiError(400, error.message || "Something went wrong");
//   }
// });

// const getUserRecordsWithTransactions = asyncHandler(async (req, res) => {
//   try {
//     // Fetch all user records from the database
//     const userRecords = await User.find();

//     // Check if there are no user records fetched
//     if (!userRecords || userRecords.length === 0) {
//       return res
//         .status(200)
//         .json(new ApiResponse(401, {}, "No user records found"));
//     }

//     // For each user, fetch the wallet balance and transactions
//     const userRecordsWithDetails = await Promise.all(
//       userRecords.map(async (user) => {
//         const wallet = await Wallet.findOne({ userId: user._id }).select(
//           "walletAmount"
//         );
//         const transactions = await WalletTransaction.find({ userId: user._id });

//         return {
//           ...user.toObject(), // Convert mongoose object to plain JS object
//           walletBalance: wallet ? wallet.walletAmount : 0, // Add wallet balance
//           transactions, // Include user transactions
//         };
//       })
//     );

//     // Return success response with user records, wallet balance, and transactions
//     return res
//       .status(200)
//       .json(
//         new ApiResponse(
//           200,
//           userRecordsWithDetails,
//           "Data fetched successfully"
//         )
//       );
//   } catch (error) {
//     console.error(
//       "Error fetching user records with transactions:",
//       error.message
//     );
//     throw new ApiError(400, error.message || "Something went wrong");
//   }
// });
